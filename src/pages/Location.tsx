import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, MapPin, Search, Loader2, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { searchAddress, NaverSearchResult as KakaoSearchResult } from "@/lib/naver";
import { getAddressFromCoords } from "@/lib/geocoding";
import { getBrowserPosition } from "@/lib/geolocation";
import { AutoFitMarquee } from "@/components/AutoFitMarquee";
import { useAppLocale } from "@/contexts/AppLocaleContext";

interface RecentLocation {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

const Location = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { locale } = useAppLocale();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [searchResults, setSearchResults] = useState<KakaoSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);

  useEffect(() => {
    // 최근 위치 불러오기
    const savedLocations = localStorage.getItem("recentLocations");
    if (savedLocations) {
      try {
        setRecentLocations(JSON.parse(savedLocations));
      } catch (error) {
        console.error("최근 위치 불러오기 오류:", error);
      }
    }
  }, []);

  // 검색 로직 (debounce 적용)
  useEffect(() => {
    const delaySearch = setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const result = await searchAddress(searchQuery, locale);
        setSearchResults(result.documents);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "주소 검색 중 오류가 발생했습니다.";
        console.error("❌ [주소 검색] 검색 오류:", error);
        toast({
          title: "검색 실패",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(delaySearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]); // toast는 안정적인 참조를 가지므로 dependency에서 제외

  const saveToRecentLocations = useCallback(
    (
      name: string,
      address: string,
      coordinates?: { latitude: number; longitude: number }
    ) => {
      setRecentLocations((prev) => {
        const newLocation: RecentLocation = {
          name,
          address,
          ...(coordinates
            ? { latitude: coordinates.latitude, longitude: coordinates.longitude }
            : {}),
        };
        const updated = [
          newLocation,
          ...prev.filter((loc) => loc.name !== name),
        ].slice(0, 5);

        localStorage.setItem("recentLocations", JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const handleLocationSelect = (name: string, address?: string, coordinates?: { latitude: number; longitude: number }) => {
    localStorage.setItem("selectedLocation", name);

    // 좌표가 있으면 저장
    if (coordinates) {
      localStorage.setItem("currentCoordinates", JSON.stringify(coordinates));
    } else {
      // 좌표가 없어도 직접 설정한 위치로 처리 (최근 위치 선택 시)
      localStorage.removeItem("currentCoordinates");
    }
    
    // 직접 설정한 위치임을 표시 (이후 현재 위치를 자동으로 가져오지 않도록)
    // 최근 위치를 선택했을 때도 직접 설정한 것으로 처리
    localStorage.setItem("isManualLocation", "true");
    
    // 최근 위치에 추가
    if (address) {
      saveToRecentLocations(name, address, coordinates);
    }

    navigate("/main");
  };

  const handleSearchResultSelect = (result: KakaoSearchResult) => {
    const displayName = result.place_name || result.address_name;
    const fullAddress = result.road_address_name || result.address_name;
    
    // 검색 결과에서 좌표 정보 추출 (x: longitude, y: latitude)
    const coordinates = result.x && result.y 
      ? { latitude: parseFloat(result.y), longitude: parseFloat(result.x) }
      : undefined;
    
    handleLocationSelect(displayName, fullAddress, coordinates);
  };

  const handleCurrentLocation = async () => {
    const isReactNative = (window as any).isReactNative === true;

    if (!navigator.geolocation) {
      toast({
        title: "위치 서비스 미지원",
        description: isReactNative
          ? "앱이 위치 서비스를 지원하지 않습니다."
          : "브라우저가 위치 서비스를 지원하지 않습니다.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingLocation(true);

    try {
      const { latitude, longitude } = await getBrowserPosition();

      const address = await getAddressFromCoords(latitude, longitude, locale);
      const displayName = address !== "위치를 확인할 수 없음" ? address : "현재 위치";

      localStorage.setItem("currentCoordinates", JSON.stringify({ latitude, longitude }));
      localStorage.setItem("selectedLocation", displayName);
      localStorage.removeItem("isManualLocation");

      setIsLoadingLocation(false);
      navigate("/main");
    } catch (error) {
      setIsLoadingLocation(false);
      const geoError = error as GeolocationPositionError;
      let errorMessage = "위치를 가져올 수 없습니다.";

      switch (geoError?.code) {
        case 1:
          errorMessage = isReactNative
            ? "위치 권한이 거부되었습니다. 앱 설정에서 위치 권한을 허용해주세요."
            : "위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.";
          break;
        case 2:
          errorMessage = "위치 정보를 사용할 수 없습니다.";
          console.error("❌ [위치 정보] 위치 정보를 사용할 수 없음:", geoError);
          break;
        case 3:
          errorMessage = "위치 요청 시간이 초과되었습니다. 잠시 후 다시 시도하거나 주소를 검색해 주세요.";
          console.error("❌ [위치 정보] 위치 요청 시간 초과:", geoError);
          break;
        default:
          console.error("❌ [위치 정보] 위치 가져오기 실패:", geoError);
      }

      toast({
        title: "위치 가져오기 실패",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/main">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold flex-1">위치 설정</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="주소 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 h-12 rounded-xl ${searchQuery ? 'pr-10' : ''}`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="검색어 지우기"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Current Location Button */}
        <div className="mb-6">
          <Button
            variant="outline"
            className="w-full justify-start h-14 rounded-xl border-primary/50 hover:bg-primary/5"
            onClick={handleCurrentLocation}
            disabled={isLoadingLocation}
          >
            {isLoadingLocation ? (
              <Loader2 className="w-5 h-5 mr-3 text-primary animate-spin" />
            ) : (
              <MapPin className="w-5 h-5 mr-3 text-primary" />
            )}
            <span className="font-medium">
              {isLoadingLocation ? "위치 가져오는 중..." : "현재 위치로 설정"}
            </span>
          </Button>
        </div>

        {/* Search Results */}
        {searchQuery.trim().length >= 2 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-4">
              검색 결과
              {isSearching && (
                <Loader2 className="w-4 h-4 ml-2 inline animate-spin" />
              )}
            </h2>
            {!isSearching && (
              <div className="space-y-2">
                {searchResults.length > 0 ? (
                  searchResults.map((result, index) => (
                    <Card
                      key={`${result.place_name}-${index}`}
                      className="p-4 cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => handleSearchResultSelect(result)}
                    >
                      <div className="flex items-start">
                        <MapPin className="w-4 h-4 mr-3 mt-1 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <AutoFitMarquee text={result.place_name} textClassName="font-medium" />
                          <AutoFitMarquee
                            as="p"
                            text={result.road_address_name || result.address_name}
                            textClassName="text-muted-foreground"
                            fontSizeClasses={["text-sm", "text-xs"]}
                          />
                          {result.category_name && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {result.category_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    검색 결과가 없습니다.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recent Locations */}
        {searchQuery.trim().length < 2 && recentLocations.length > 0 && (
          <div>
            <h2 className="text-lg font-bold mb-4">최근 위치</h2>
            <div className="space-y-2">
              {recentLocations.map((location, index) => (
                <Card
                  key={`${location.name}-${index}`}
                  className="p-4 cursor-pointer hover:bg-accent transition-colors"
                  onClick={() =>
                    handleLocationSelect(
                      location.name,
                      location.address,
                      location.latitude != null && location.longitude != null
                        ? { latitude: location.latitude, longitude: location.longitude }
                        : undefined
                    )
                  }
                >
                  <div className="flex items-start">
                    <MapPin className="w-4 h-4 mr-3 mt-1 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <AutoFitMarquee text={location.name} textClassName="font-medium" />
                      {location.address && location.address !== location.name && (
                        <AutoFitMarquee
                          as="p"
                          text={location.address}
                          textClassName="text-muted-foreground"
                          fontSizeClasses={["text-sm", "text-xs"]}
                        />
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Location;
