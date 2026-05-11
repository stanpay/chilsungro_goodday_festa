import { MapPin, ArrowUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import StoreCard from "@/components/StoreCard";
import BottomNav from "@/components/BottomNav";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TutorialBanner from "@/components/TutorialBanner";
import TutorialGuide from "@/components/TutorialGuide";
import TutorialPointer from "@/components/TutorialPointer";
import { setTutorialStep } from "@/lib/tutorial";

const TutorialMain = () => {
  const [currentLocation] = useState("강남구 역삼동");
  const [showStoreGuide, setShowStoreGuide] = useState(false);
  const firstStoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 스크롤 방지
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    
    // 0.5초 뒤 가이드 표시
    const timer = setTimeout(() => {
      setShowStoreGuide(true);
      setTutorialStep("main_store_select");
    }, 500);

    return () => {
      document.body.style.overflow = prevOverflow;
      clearTimeout(timer);
    };
  }, []);

  const displayStores = [
    {
      id: "mock-starbucks-1",
      name: "스타벅스 역삼역점",
      distance: "120m",
      distanceNum: 120,
      image: "starbucks",
      maxDiscount: "최대 10% 할인",
      discountNum: 10,
      maxDiscountPercent: 10,
      address: "서울 강남구 역삼동 823-1",
    },
    {
      id: "fake-store-1",
      name: "배스킨라빈스 역삼점",
      distance: "250m",
      distanceNum: 250,
      image: "baskin",
      maxDiscount: null,
      discountNum: 0,
      maxDiscountPercent: null,
      address: "서울 강남구 역삼동",
    },
    {
      id: "fake-store-2",
      name: "메가커피 강남점",
      distance: "450m",
      distanceNum: 450,
      image: "mega",
      maxDiscount: null,
      discountNum: 0,
      maxDiscountPercent: null,
      address: "서울 강남구 역삼동",
    },
    {
      id: "fake-store-3",
      name: "투썸플레이스 테헤란로점",
      distance: "580m",
      distanceNum: 580,
      image: "twosome",
      maxDiscount: null,
      discountNum: 0,
      maxDiscountPercent: null,
      address: "서울 강남구 역삼동",
    },
    {
      id: "fake-store-4",
      name: "파스쿠찌 역삼점",
      distance: "720m",
      distanceNum: 720,
      image: "pascucci",
      maxDiscount: null,
      discountNum: 0,
      maxDiscountPercent: null,
      address: "서울 강남구 역삼동",
    },
    {
      id: "fake-store-5",
      name: "컴포즈커피 역삼점",
      distance: "850m",
      distanceNum: 850,
      image: "compose",
      maxDiscount: null,
      discountNum: 0,
      maxDiscountPercent: null,
      address: "서울 강남구 역삼동",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 overflow-hidden">
      <TutorialBanner />
      
      <header className="sticky top-0 z-40 bg-card border-b border-border/50 backdrop-blur-sm bg-opacity-95 pointer-events-none">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-2 w-full">
            <Button 
              variant="outline" 
              className="group flex-1 justify-start h-12 rounded-xl border-border/50 transition-colors"
              disabled
            >
              <div className="flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-primary" />
                <span className="font-medium">현재 위치: {currentLocation}</span>
              </div>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 pointer-events-none">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="매장 검색..."
            readOnly
            className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none transition-all cursor-not-allowed"
          />
        </div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">결제 가능 매장</h2>
            <p className="text-muted-foreground">거리 순으로 정렬됩니다</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled
            className="flex items-center gap-2"
          >
            <ArrowUpDown className="w-4 h-4" />
            거리순
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 animate-fade-in pointer-events-auto">
          {displayStores.map((store, index) => (
            <div
              key={store.id}
              ref={index === 0 ? firstStoreRef : null}
              className={index === 0 ? "pointer-events-auto" : "pointer-events-none"}
            >
              <StoreCard 
                {...store}
                tutorialMode
                isHighlighted={false}
                disabled={index > 0}
              />
            </div>
          ))}
        </div>
        
        {showStoreGuide && firstStoreRef.current && (
          <TutorialGuide
            targetElement={firstStoreRef.current}
            message="첫 번째 매장을 선택하여 튜토리얼을 시작하세요!"
            position="bottom"
            onNext={() => {
              setShowStoreGuide(false);
              setTutorialStep(null);
            }}
          />
        )}

        {/* 튜토리얼용 터치 유도 포인터 (첫 매장 선택 유도) */}
        {showStoreGuide && firstStoreRef.current && (
          <TutorialPointer targetElement={firstStoreRef.current} />
        )}
      </main>

      <div className="pointer-events-none">
        <BottomNav />
      </div>
    </div>
  );
};

export default TutorialMain;
