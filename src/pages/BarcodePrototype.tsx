import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardStack } from "@/components/ui/card-stack";
import { Gift, CreditCard, ExternalLink, Monitor, User, Plus, ChevronUp } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import JsBarcode from "jsbarcode";

/**
 * 개발자를 위한 바코드 프로토타입 페이지
 * 이 페이지는 바코드 표시 방식을 쉽게 수정하고 테스트할 수 있도록 구성되어 있습니다.
 * 
 * 사용 방법:
 * 1. 바코드 번호를 수정하려면 barcodeNumber 상태를 변경하세요
 * 2. 스타일을 수정하려면 각 컴포넌트의 className을 수정하세요
 * 3. 레이아웃을 변경하려면 JSX 구조를 수정하세요
 */
const BarcodePrototype = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  
  // ========== 수정 가능한 설정 ==========
  // 바코드 번호 (여기서 수정하세요)
  const [barcodeNumber, setBarcodeNumber] = useState("1234567890123");
  
  // 기프티콘 정보 (여기서 수정하세요)
  const [gifticonInfo, setGifticonInfo] = useState({
    name: "스타벅스 아메리카노 Tall",
    price: 4500,
  });
  
  // 멤버십 정보 (여기서 수정하세요)
  const [membershipInfo, setMembershipInfo] = useState({
    name: "스타벅스",
    barcode: "1234567890123",
  });
  
  // 바코드 스타일 설정 (여기서 수정하세요)
  const barcodeConfig = {
    width: 2,           // 바코드 선 두께
    height: 80,         // 바코드 높이
    displayValue: false, // 바코드 번호 표시 여부
    lineColor: "#000000", // 바코드 색상
  };
  
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const totalCards = 2; // 기프티콘 카드 + 멤버십 카드

  // 키오스크 모드
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [kioskCurrentIndex, setKioskCurrentIndex] = useState(0);
  const enterKioskMode = () => {
    setKioskCurrentIndex(currentCardIndex);
    setIsKioskMode(true);
  };
  const exitKioskMode = () => setIsKioskMode(false);

  // ========== 바코드 표시 컴포넌트 ==========
  const BarcodeDisplay = ({ number, bare, kiosk }: { number: string; bare?: boolean; kiosk?: boolean }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
      if (svgRef.current && number) {
        try {
          // 숫자만 추출 (문자열이 있을 수 있음)
          const barcodeNum = number.replace(/\D/g, '');
          
          if (barcodeNum.length === 0) {
            return;
          }

          // EAN-13 형식인지 확인 (13자리)
          if (barcodeNum.length === 13) {
            try {
              JsBarcode(svgRef.current, barcodeNum, {
                format: "EAN13",
                ...barcodeConfig,
                ...(kiosk && { width: 3, height: 100 }),
                background: "transparent",
                margin: 0,
              });
            } catch (ean13Error) {
              // EAN-13 체크섬 오류 시 CODE128로 대체
              console.warn("EAN13 체크섬 오류, CODE128로 변경:", ean13Error);
              JsBarcode(svgRef.current, barcodeNum, {
                format: "CODE128",
                ...barcodeConfig,
                ...(kiosk && { width: 3, height: 100 }),
                background: "transparent",
                margin: 0,
              });
            }
          } else if (barcodeNum.length === 8) {
            // EAN-8 형식 (8자리)
            try {
              JsBarcode(svgRef.current, barcodeNum, {
                format: "EAN8",
                ...barcodeConfig,
                ...(kiosk && { width: 3, height: 100 }),
                background: "transparent",
                margin: 0,
              });
            } catch (ean8Error) {
              // EAN-8 체크섬 오류 시 CODE128로 대체
              console.warn("EAN8 체크섬 오류, CODE128로 변경:", ean8Error);
              JsBarcode(svgRef.current, barcodeNum, {
                format: "CODE128",
                ...barcodeConfig,
                ...(kiosk && { width: 3, height: 100 }),
                background: "transparent",
                margin: 0,
              });
            }
          } else {
            // CODE128 형식 (다양한 길이 지원)
            JsBarcode(svgRef.current, barcodeNum, {
              format: "CODE128",
              ...barcodeConfig,
              ...(kiosk && { width: 3, height: 100 }),
              background: "transparent",
              margin: 0,
            });
          }
        } catch (error) {
          console.error("바코드 생성 오류:", error);
        }
      }
    }, [number, kiosk]);

    if (kiosk) {
      return (
        <div className="flex flex-col w-full items-stretch">
          <div className="flex items-center justify-center bg-white py-2 rounded-lg w-full min-w-0">
            <svg
              ref={svgRef}
              className="w-full h-auto max-w-full"
              preserveAspectRatio="xMidYMid meet"
            />
          </div>
          <p className="text-center font-mono text-xs tracking-widest mt-1 w-full">{number}</p>
        </div>
      );
    }
    return (
      <div className="space-y-0.5">
        {bare ? (
          <svg
            ref={svgRef}
            className="max-w-full h-20"
            style={{ maxHeight: '80px' }}
          />
        ) : (
          <div className="flex items-center justify-center bg-white p-2 rounded-lg">
            <svg
              ref={svgRef}
              className="max-w-full h-20"
              style={{ maxHeight: '80px' }}
            />
          </div>
        )}
        <p className="text-center font-mono text-xs tracking-widest">{number}</p>
      </div>
    );
  };

  const kioskCards = useMemo(
    () => [
      {
        id: 0,
        content: (
          <div
            className="flex flex-col w-full h-full p-4 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-start w-full flex-1 min-h-0">
              <BarcodeDisplay number={barcodeNumber} kiosk />
            </div>
            <div
              className="bg-white p-4 space-y-1 shrink-0"
              style={{ color: "rgba(38, 34, 42, 1)", backgroundColor: "rgba(255, 255, 255, 1)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">기프티콘</p>
                  <p className="font-bold text-sm">{gifticonInfo.name}</p>
                  <p className="text-xs text-muted-foreground">{gifticonInfo.price.toLocaleString()}원</p>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 1,
        content: (
          <div
            className="flex flex-col w-full h-full p-4 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-start w-full flex-1 min-h-0">
              <BarcodeDisplay number={membershipInfo.barcode} kiosk />
            </div>
            <div
              className="bg-white p-4 space-y-1 shrink-0"
              style={{ color: "rgba(38, 34, 42, 1)", backgroundColor: "rgba(255, 255, 255, 1)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-4 h-4 text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">멤버십</p>
                  <p className="font-bold text-sm">{membershipInfo.name}</p>
                </div>
              </div>
            </div>
          </div>
        ),
      },
    ],
    [barcodeNumber, gifticonInfo, membershipInfo]
  );

  return (
    <div className="bg-background h-screen overflow-hidden">
      {/* 키오스크 모드 오버레이 */}
      {isKioskMode && (
        <div
          className="fixed inset-0 z-50 bg-background flex flex-col pt-0 px-0 pb-4 overflow-hidden"
          onClick={exitKioskMode}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Escape" && exitKioskMode()}
          aria-label="바코드가 아닌 영역 터치 시 키오스크 모드 종료"
        >
          <div className="flex-1 min-h-0 flex flex-col items-center overflow-hidden pt-0 pb-2" onClick={(e) => e.stopPropagation()}>
            <CardStack
              items={kioskCards}
              initialIndex={currentCardIndex}
              onIndexChange={setKioskCurrentIndex}
              offset={40}
              scaleFactor={0.08}
              className="relative w-full h-[320px] shrink-0"
              cardClassName="absolute left-0 right-0 top-0 rounded-t-none rounded-b-2xl border border-border/50 bg-card shadow-lg overflow-hidden flex flex-col h-[280px] w-full"
            />
            {/* 위로 스와이프 안내 - 바코드 스택 바로 아래 */}
            <div className="flex flex-col items-center gap-2 pt-2 shrink-0 px-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ChevronUp
                  className="w-5 h-5 animate-bounce"
                  style={{ animationDuration: "1.5s" }}
                  aria-hidden
                />
                <span className="text-sm">위로 스와이프하여 다음 바코드로 넘김</span>
              </div>
              <span className="text-xs text-muted-foreground/80">
                {kioskCurrentIndex + 1} / {totalCards}
              </span>
            </div>
          </div>
          {/* 키오스크 하단 버튼 영역 */}
          <div
            className="absolute bottom-4 left-4 right-4 space-y-3 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              onClick={() => console.log("결제앱 실행")}
              className="w-full h-14 text-lg font-semibold rounded-xl opacity-50"
            >
              결제앱 실행
            </Button>
            <Button
              onClick={() => {
                console.log("결제 완료");
                navigate(-1);
              }}
              className="w-full h-14 text-lg font-semibold rounded-xl"
            >
              결제 완료
            </Button>
          </div>
        </div>
      )}

      {/* 헤더 - 키오스크 모드에서는 숨김 */}
      {!isKioskMode && (
        <div className="absolute left-2 top-4 flex flex-col gap-3 z-50">
          {/* 페이지 인디케이터 */}
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: totalCards }).map((_, index) => (
              <div
                key={index}
                className={`w-1 rounded-full transition-all duration-300 ${
                  index === currentCardIndex
                    ? "h-8 bg-primary"
                    : "h-4 bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="flex flex-col h-full py-4 overflow-hidden">
        <div 
          className="flex-1 overflow-hidden snap-y snap-mandatory scrollbar-hide pb-32 px-4"
          style={{
            scrollSnapType: 'y mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
          onScroll={(e) => {
            const container = e.currentTarget;
            const cards = Array.from(container.children);
            let minDistance = Infinity;
            let closestIndex = 0;
            
            cards.forEach((card, index) => {
              const rect = (card as HTMLElement).getBoundingClientRect();
              const containerRect = container.getBoundingClientRect();
              const distance = Math.abs(rect.top - containerRect.top);
              
              if (distance < minDistance) {
                minDistance = distance;
                closestIndex = index;
              }
            });
            
            if (closestIndex !== currentCardIndex) {
              setCurrentCardIndex(closestIndex);
            }
          }}
        >
          {/* 기프티콘 바코드 카드 */}
          <div
            className="snap-start mb-4"
            style={{
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
            }}
          >
            <Card
              className="p-0 rounded-2xl border-border/50 relative overflow-hidden cursor-pointer"
              onClick={enterKioskMode}
            >
              {/* 바코드 영역 - 흰 배경에 선명 (윗공간·아래공간 기프티콘/멤버십 기준 통일) */}
              <div className="rounded-t-2xl h-[130px] bg-white border border-border/50 border-b-0 px-4 pt-3 pb-1.5 relative flex flex-col items-center justify-center">
                <BarcodeDisplay number={barcodeNumber} />
              </div>
              {/* 기프티콘 정보 영역 */}
              <div
                className="rounded-b-2xl bg-white border border-border/50 p-4 space-y-1"
                style={{
                  color: "rgba(38, 34, 42, 1)",
                  backgroundColor: "rgba(255, 255, 255, 1)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Gift className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">기프티콘</p>
                    <p className="font-bold text-sm">{gifticonInfo.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {gifticonInfo.price.toLocaleString()}원
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* 멤버십 바코드 카드 */}
          <div 
            className="snap-start"
            style={{
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
            }}
          >
            <Card
              className="p-0 rounded-2xl border-border/50 relative overflow-hidden cursor-pointer"
              onClick={enterKioskMode}
            >
              {/* 바코드 영역 - 이미지 업로드 등록 */}
              <div className="rounded-t-2xl h-[130px] bg-muted border border-border/50 border-b-0 px-4 pt-3 pb-1.5 relative flex flex-col items-center justify-center gap-2">
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
                  <BarcodeDisplay number={membershipInfo.barcode} />
                </div>
                <button
                  type="button"
                  className="w-12 h-12 rounded-full border-2 border-dashed border-primary flex items-center justify-center text-primary hover:border-primary/80 hover:text-primary/80 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log("바코드 이미지 업로드");
                  }}
                >
                  <Plus className="w-6 h-6" />
                </button>
                <p className="text-xs text-muted-foreground">+버튼을 눌러 바코드를 등록하세요</p>
              </div>
              {/* 멤버십 정보 영역 - 별도 블록 */}
              <div
                className="rounded-b-2xl bg-white border border-border/50 p-4 space-y-1"
                style={{
                  color: "rgba(38, 34, 42, 1)",
                  backgroundColor: "rgba(255, 255, 255, 1)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-4 h-4 text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">멤버십</p>
                    <p className="font-bold text-sm">{membershipInfo.name}</p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 h-8 text-xs font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log("멤버십 앱 실행");
                    }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    앱 실행
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* 키오스크/일반모드 전환 버튼 - ChatSupport 버튼 바로 위 */}
      <Button
        onClick={isKioskMode ? exitKioskMode : enterKioskMode}
        variant="outline"
        className="fixed bottom-40 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-background border-2 border-primary text-primary hover:bg-primary/10"
        size="icon"
        title={isKioskMode ? "일반 모드" : "키오스크 모드"}
      >
        {isKioskMode ? <User className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
      </Button>

      {/* 하단 버튼 영역 - 여기서 수정 가능 */}
      <div className="absolute bottom-4 left-4 right-4 space-y-3">
        <div className="relative">
          <Button
            onClick={() => {
              console.log("결제앱 실행");
            }}
            className="w-full h-14 text-lg font-semibold rounded-xl opacity-50"
          >
            결제앱 실행
          </Button>
        </div>
        <Button
          onClick={() => {
            console.log("결제 완료");
            navigate(-1);
          }}
          className="w-full h-14 text-lg font-semibold rounded-xl"
        >
          결제 완료
        </Button>
      </div>
    </div>
  );
};

export default BarcodePrototype;
