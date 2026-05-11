import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, MapPin, Search, Loader2, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { searchAddress, KakaoSearchResult } from "@/lib/kakao";

interface RecentLocation {
  name: string;
  address: string;
}

const Location = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
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
        const result = await searchAddress(searchQuery);
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

  const saveToRecentLocations = useCallback((name: string, address: string) => {
    setRecentLocations((prev) => {
      const newLocation: RecentLocation = { name, address };
      const updated = [
        newLocation,
        ...prev.filter((loc) => loc.name !== name),
      ].slice(0, 5); // 최대 5개까지만 저장

      localStorage.setItem("recentLocations", JSON.stringify(updated));
      return updated;
    });
  }, []);

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
      saveToRecentLocations(name, address);
    }
    
    toast({
      title: "위치 설정 완료",
      description: `${name}(으)로 설정되었습니다.`,
    });
    
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

  const handleCurrentLocation = () => {
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

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        // 좌표를 저장
        localStorage.setItem("currentCoordinates", JSON.stringify({ latitude, longitude }));
        localStorage.setItem("selectedLocation", "현재 위치");
        
        setIsLoadingLocation(false);
        toast({
          title: "위치 설정 완료",
          description: "현재 위치로 설정되었습니다.",
        });
        navigate("/main");
      },
      (error) => {
        setIsLoadingLocation(false);
        let errorMessage = "위치를 가져올 수 없습니다.";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
          case 1: // PERMISSION_DENIED
            errorMessage = isReactNative
              ? "위치 권한이 거부되었습니다. 앱 설정에서 위치 권한을 허용해주세요."
              : "위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.";
            // 사용자가 의도적으로 거부한 경우이므로 콘솔 에러를 출력하지 않음
            break;
          case error.POSITION_UNAVAILABLE:
          case 2: // POSITION_UNAVAILABLE
            errorMessage = "위치 정보를 사용할 수 없습니다.";
            console.error("❌ [위치 정보] 위치 정보를 사용할 수 없음:", error);
            break;
          case error.TIMEOUT:
          case 3: // TIMEOUT
            errorMessage = "위치 요청 시간이 초과되었습니다.";
            console.error("❌ [위치 정보] 위치 요청 시간 초과:", error);
            break;
          default:
            console.error("❌ [위치 정보] 위치 가져오기 실패:", error);
        }
        
        toast({
          title: "위치 가져오기 실패",
          description: errorMessage,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
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
                          <p className="font-medium truncate">{result.place_name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {result.road_address_name || result.address_name}
                          </p>
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
                  onClick={() => handleLocationSelect(location.name, location.address)}
                >
                  <div className="flex items-start">
                    <MapPin className="w-4 h-4 mr-3 mt-1 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{location.name}</p>
                      {location.address && location.address !== location.name && (
                        <p className="text-sm text-muted-foreground truncate">
                          {location.address}
                        </p>
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
