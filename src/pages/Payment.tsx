import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Gift, CreditCard, Loader2, Ticket, ChevronDown, ChevronUp, Plus, ExternalLink } from "lucide-react";
import { Link, useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import JsBarcode from "jsbarcode";
import { initPaymentWidget, generateOrderId } from "@/lib/tossPayments";
import { cn } from "@/lib/utils";
interface UsedGifticon {
  id: string;
  available_at: string;
  name?: string;
  expiry_date: string;
  barcode: string;
  original_price: number;
  sale_price: number;
}

interface SelectedGifticon {
  id: string;
  sale_price: number;
  reservedId: string; // 대기중인 기프티콘 ID (단일 선택)
}

interface Coupon {
  id: string;
  name: string;
  description: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_purchase_amount: number | null;
  expiry_date: string;
  status: 'available' | 'used' | 'expired';
}

// 숫자를 한글 숫자 문자열로 변환하는 함수 (1~9999)
// includeOne: true면 1을 "일"로 표시, false면 생략 (기본값: false)
const formatKoreanNumber = (num: number, includeOne: boolean = false): string => {
  if (num === 0) return "";
  
  const koreanNumbers = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  let result = "";
  
  // 천 단위
  if (num >= 1000) {
    const cheon = Math.floor(num / 1000);
    if (cheon > 0) {
      if (cheon === 1) {
        result += "천";
      } else {
        result += koreanNumbers[cheon] + "천";
      }
    }
    num = num % 1000;
  }
  
  // 백 단위
  if (num >= 100) {
    const baek = Math.floor(num / 100);
    if (baek > 0) {
      if (baek === 1) {
        result += "백";
      } else {
        result += koreanNumbers[baek] + "백";
      }
    }
    num = num % 100;
  }
  
  // 십 단위
  if (num >= 10) {
    const sip = Math.floor(num / 10);
    if (sip > 0) {
      if (sip === 1) {
        result += "십";
      } else {
        result += koreanNumbers[sip] + "십";
      }
    }
    num = num % 10;
  }
  
  // 일 단위
  if (num > 0) {
    result += koreanNumbers[num];
  }
  
  // 전체 숫자가 1이고 includeOne이 true면 "일" 반환
  if (result === "" && includeOne) {
    return "일";
  }
  
  return result;
};

// 숫자를 한글 금액으로 변환하는 함수
const formatToKoreanCurrency = (amount: number): string => {
  if (amount === 0) return "";
  
  let result = "";
  let remaining = amount;
  
  // 억 단위 처리
  if (remaining >= 100000000) {
    const eok = Math.floor(remaining / 100000000);
    if (eok > 0) {
      const eokStr = formatKoreanNumber(eok, true); // 억 단위는 1도 "일"로 표시
      result += eokStr + "억";
    }
    remaining = remaining % 100000000;
  }
  
  // 만 단위 처리
  if (remaining >= 10000) {
    const man = Math.floor(remaining / 10000);
    if (man > 0) {
      const manStr = formatKoreanNumber(man, true); // 만 단위는 1도 "일"로 표시
      result += manStr + "만";
    }
    remaining = remaining % 10000;
  }
  
  // 천 단위 처리
  if (remaining >= 1000) {
    const cheon = Math.floor(remaining / 1000);
    if (cheon > 0) {
      const cheonStr = formatKoreanNumber(cheon);
      result += cheonStr + "천";
    }
    remaining = remaining % 1000;
  }
  
  // 백 단위 처리
  if (remaining >= 100) {
    const baek = Math.floor(remaining / 100);
    if (baek > 0) {
      const baekStr = formatKoreanNumber(baek);
      result += baekStr + "백";
    }
    remaining = remaining % 100;
  }
  
  // 십 단위 처리
  if (remaining >= 10) {
    const sip = Math.floor(remaining / 10);
    if (sip > 0) {
      const sipStr = formatKoreanNumber(sip);
      result += sipStr + "십";
    }
    remaining = remaining % 10;
  }
  
  // 일 단위 처리
  if (remaining > 0) {
    const koreanNumbers = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
    result += koreanNumbers[remaining];
  }
  
  return result + "원";
};

// 숫자에 콤마 추가
const formatNumberWithCommas = (value: string | number | null): string => {
  if (value === null || value === "") return "";
  const numStr = value.toString().replace(/,/g, "");
  if (numStr === "") return "";
  return parseInt(numStr, 10).toLocaleString("ko-KR");
};

const Payment = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: 기프티콘 선택, 2: 결제 수단 선택, 3: 바코드
  const [gifticons, setGifticons] = useState<UsedGifticon[]>([]);
  const [selectedGifticons, setSelectedGifticons] = useState<Map<string, SelectedGifticon>>(new Map());
  // 추가로 불러온 기프티콘의 관계 추적 (key: 추가된 기프티콘 ID, value: 원본 기프티콘 ID)
  const [addedGifticonRelations, setAddedGifticonRelations] = useState<Map<string, string>>(new Map());
  // 초기 로딩된 기프티콘 ID 목록 (화면에서 사라지지 않아야 하는 기프티콘들)
  const [initialGifticonIds, setInitialGifticonIds] = useState<Set<string>>(new Set());
  // 각 기프티콘의 불러온 순서 추적 (key: 기프티콘 ID, value: 불러온 순서)
  const [gifticonLoadOrder, setGifticonLoadOrder] = useState<Map<string, number>>(new Map());
  // 금액대별 기프티콘 배열 관리 (key: 금액대, value: 해당 금액대의 기프티콘 배열)
  const [gifticonsByPriceRange, setGifticonsByPriceRange] = useState<Map<number, UsedGifticon[]>>(new Map());
  let loadOrderCounter = useRef(0);
  // 추가 로드 중인 기프티콘 ID 추적 (중복 호출 방지)
  const loadingGifticonIds = useRef<Set<string>>(new Set());
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [actualStoreName, setActualStoreName] = useState<string>("");
  const [recentlyPurchasedCount, setRecentlyPurchasedCount] = useState<number>(0);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [storeBrand, setStoreBrand] = useState<string>(""); // 매장 브랜드명 (스타벅스, 파스쿠찌 등)
  const [actualGifticonBarcodes, setActualGifticonBarcodes] = useState<Map<string, string>>(new Map()); // 실제 기프티콘 바코드 맵
  const [franchiseId, setFranchiseId] = useState<string | null>(null);
  const [franchisePaymentMethods, setFranchisePaymentMethods] = useState<Array<{
    method_name: string;
    method_type: string | null;
    rate: number | null;
  }>>([]);
  // 결제 완료된 기프티콘 추적 (뒤로가기 방지용)
  const [completedPurchases, setCompletedPurchases] = useState<Set<string>>(new Set());
  
  const [storeInfo, setStoreInfo] = useState<{
    gifticon_available: boolean;
    local_currency_available: boolean;
    local_currency_discount_rate: number | null;
    parking_available: boolean;
    free_parking: boolean;
    parking_size: string | null;
  } | null>(null);
  const [isLoadingStoreInfo, setIsLoadingStoreInfo] = useState<boolean>(true);
  const [selectedPaymentOptions, setSelectedPaymentOptions] = useState<Set<string>>(new Set());
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState<boolean>(true);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isStoreNameLoaded, setIsStoreNameLoaded] = useState<boolean>(false);
  const [hasInitialDataLoaded, setHasInitialDataLoaded] = useState<boolean>(false);
  const [hasUserSelectedPaymentMethodManually, setHasUserSelectedPaymentMethodManually] = useState<boolean>(false);
  const [inputBudget, setInputBudget] = useState<number | null>(null); // 입력된 예산
  const [isAutoSelectMode, setIsAutoSelectMode] = useState<boolean>(false); // 자동선택 모드 여부
  const [autoSelectedGifticons, setAutoSelectedGifticons] = useState<UsedGifticon[]>([]); // 자동선택 모드의 기프티콘 목록
  
  const totalSummaryRef = useRef<HTMLDivElement>(null);
  const membershipCardRef = useRef<HTMLDivElement>(null);
  const membershipAppRef = useRef<HTMLButtonElement>(null);
  const membershipBarcodeRef = useRef<HTMLDivElement>(null);
  const payAppButtonRef = useRef<HTMLButtonElement>(null);
  const paymentCompleteButtonRef = useRef<HTMLButtonElement>(null);
  const [paymentWidgets, setPaymentWidgets] = useState<any>(null); // 결제위젯 인스턴스
  const [isWidgetRendered, setIsWidgetRendered] = useState<boolean>(false); // 위젯 렌더링 상태
  const widgetInstanceRef = useRef<any>(null); // 위젯 인스턴스 캐싱
  const [remainingTime, setRemainingTime] = useState<number>(60); // Step 1 타이머 (초 단위)
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]); // 사용 가능한 할인쿠폰 목록
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null); // 선택된 할인쿠폰
  const [isCouponExpanded, setIsCouponExpanded] = useState<boolean>(false); // 할인쿠폰 섹션 펼침 여부
  const [hasPaymentHistory, setHasPaymentHistory] = useState<boolean>(false);

  // 할인율 계산 함수
  const getDiscountRate = (originalPrice: number, salePrice: number): number => {
    const discountAmount = originalPrice - salePrice;
    return Math.round((discountAmount / originalPrice) * 100);
  };

  // 할인효율 계산 함수: (원가-할인가)/할인가
  const getDiscountEfficiency = (originalPrice: number, salePrice: number): number => {
    if (salePrice === 0) return 0;
    return (originalPrice - salePrice) / salePrice;
  };

  // 정렬 함수 (마감일 임박순 최우선, 그 다음 할인효율 내림차순, 같은 효율일 땐 판매가 오름차순)
  const sortByDiscountEfficiency = useCallback((a: UsedGifticon, b: UsedGifticon): number => {
    // 1순위: 마감일 임박순 (expiry_date 오름차순)
    const expiryA = new Date(a.expiry_date).getTime();
    const expiryB = new Date(b.expiry_date).getTime();
    if (expiryA !== expiryB) {
      return expiryA - expiryB; // 마감일 임박순 (오름차순)
    }
    
    // 2순위: 할인효율 내림차순
    const efficiencyA = getDiscountEfficiency(a.original_price, a.sale_price);
    const efficiencyB = getDiscountEfficiency(b.original_price, b.sale_price);
    if (efficiencyA !== efficiencyB) {
      return efficiencyB - efficiencyA; // 할인효율 내림차순
    }
    
    // 3순위: 같은 효율일 경우 판매가 오름차순
    return a.sale_price - b.sale_price;
  }, []);

  // 천원대별로 그룹화하는 헬퍼 함수
  const getPriceRange = (price: number): number => {
    return Math.floor(price / 1000) * 1000;
  };

  // 금액대별 기프티콘 배열 업데이트 헬퍼 함수
  const updateGifticonsByPriceRange = useCallback((gifticonsList: UsedGifticon[]) => {
    const priceRangeMap = new Map<number, UsedGifticon[]>();
    
    gifticonsList.forEach((gifticon) => {
      const priceRange = getPriceRange(gifticon.original_price);
      if (!priceRangeMap.has(priceRange)) {
        priceRangeMap.set(priceRange, []);
      }
      priceRangeMap.get(priceRange)!.push(gifticon);
    });

    // 각 금액대별로 불러온 순서대로 정렬
    priceRangeMap.forEach((gifticons, priceRange) => {
      gifticons.sort((a, b) => {
        const orderA = gifticonLoadOrder.get(a.id) ?? 0;
        const orderB = gifticonLoadOrder.get(b.id) ?? 0;
        return orderA - orderB;
      });
    });

    setGifticonsByPriceRange(priceRangeMap);
  }, [gifticonLoadOrder]);

  // 기프티콘 할인율 중 최대값 계산
  const maxGifticonDiscount = useMemo(() => {
    if (gifticons.length === 0) return 0;
    return Math.max(...gifticons.map(g => {
      const discountAmount = g.original_price - g.sale_price;
      return Math.round((discountAmount / g.original_price) * 100);
    }));
  }, [gifticons]);

  // 기프티콘 할인 방식의 할인율을 동적으로 계산
  const gifticonMethodDiscount = maxGifticonDiscount > 0 
    ? `${maxGifticonDiscount}%`
    : "0%";


  const storeNames: Record<string, string> = {
    baskin: "베스킨라빈스",
    starbucks: "스타벅스",
    mega: "메가커피",
    compose: "컴포즈커피",
    ediya: "이디야커피",
    paik: "빽다방",
    pascucci: "파스쿠찌",
    twosome: "투썸플레이스",
  };

  const membershipNames: Record<string, string> = {
    baskin: "해피포인트",
    starbucks: "스타벅스 멤버쉽",
    mega: "메가커피 멤버쉽",
    compose: "컴포즈커피 멤버쉽",
    ediya: "이디야 멤버쉽",
    paik: "빽다방 멤버쉽",
  };

  const membershipDeepLinks: Record<string, string> = {
    baskin: "https://www.happypointcard.com/",
    starbucks: "https://www.starbucks.co.kr/",
    twosome: "https://www.twosome.co.kr/",
    mega: "https://m.megacoffee.me/",
    compose: "https://composecoffee.com/",
    ediya: "https://www.ediya.com/",
    paik: "https://paikdabang.com/",
  };

  const [membershipBarcodeImage, setMembershipBarcodeImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMembershipModalOpen, setMembershipModalOpen] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setMembershipBarcodeImage(event.target?.result as string);
        toast.success("멤버십 바코드가 등록되었습니다.");
      };
      reader.readAsDataURL(file);
    }
  };

  const membershipName = membershipNames[storeId || ""] || "멤버쉽";

  const openMembershipDeepLink = () => {
    const link = membershipDeepLinks[storeId || ""];
    if (!link) {
      toast.info("관련 앱 링크가 없습니다.");
      return;
    }

    window.open(link, "_blank");
  };

  const handleMembershipAppCallout = () => {
    setMembershipModalOpen(true);
    const link = membershipDeepLinks[storeId || ""];
    if (!link) {
      toast.info("관련 앱 링크가 없습니다.");
    }
  };

  const triggerMembershipUpload = () => {
    fileInputRef.current?.click();
  };

  const handleConfirmMembershipLaunch = () => {
    setMembershipModalOpen(false);
    triggerMembershipUpload();
    openMembershipDeepLink();
  };

  const handleCloseMembershipModal = () => {
    openMembershipDeepLink();
    setMembershipModalOpen(false);
  };

  // URL 쿼리 파라미터로 step 관리 (뒤로가기 지원)
  useEffect(() => {
    const stepParam = searchParams.get('step');
    const paymentSuccess = sessionStorage.getItem('payment_success');
    
    if (paymentSuccess === 'true') {
      // 결제 성공 후 돌아온 경우 - 바코드 페이지로
      setStep(3);
      sessionStorage.removeItem('payment_success');
      toast.success('결제가 완료되었습니다! 바코드를 매장에 제시하세요.');
    } else if (stepParam === '3') {
      setStep(3);
    } else if (stepParam === '2') {
      // Step 2로 이동 - 주문 정보가 있는지 확인
      const orderDataStr = sessionStorage.getItem('toss_payment_order');
      if (orderDataStr) {
        setStep(2);
      } else {
        // 주문 정보가 없으면 Step 1로
        console.warn('주문 정보가 없습니다. Step 1로 이동합니다.');
        navigate(`/payment/${storeId}`, { replace: true });
      }
    } else {
      // 기본값은 Step 1
      setStep(1);
    }
  }, [searchParams, storeId, navigate]);

  // Step 2 진입 시 결제위젯 렌더링
  useEffect(() => {
    if (step !== 2) {
      // Step 2가 아니면 완전히 정리
      const paymentMethodEl = document.querySelector("#payment-method");
      const agreementEl = document.querySelector("#agreement");
      
      if (paymentMethodEl) paymentMethodEl.innerHTML = '';
      if (agreementEl) agreementEl.innerHTML = '';
      
      setIsWidgetRendered(false);
      setPaymentWidgets(null);
      widgetInstanceRef.current = null;
      
      console.log('🧹 결제위젯 cleanup 완료');
      return;
    }

    // 이미 렌더링된 경우 재렌더링하지 않음
    if (isWidgetRendered && paymentWidgets) {
      console.log('✅ 결제위젯 이미 렌더링됨 - 재사용');
      return;
    }

    const renderPaymentWidget = async () => {
      const renderStart = performance.now();
      
      try {
        const orderDataStr = sessionStorage.getItem('toss_payment_order');
        if (!orderDataStr) {
          console.error('주문 정보를 찾을 수 없습니다.');
          navigate(`/payment/${storeId}`, { replace: true });
          return;
        }

        const orderData = JSON.parse(orderDataStr);
        
        // DOM 완전히 비우기 (중복 렌더링 방지)
        console.log('🧹 DOM 초기화 시작');
        const paymentMethodEl = document.querySelector("#payment-method");
        const agreementEl = document.querySelector("#agreement");
        
        if (paymentMethodEl) paymentMethodEl.innerHTML = '';
        if (agreementEl) agreementEl.innerHTML = '';
        
        // 이전 인스턴스 완전히 제거
        widgetInstanceRef.current = null;
        
        // DOM 준비 대기 (최소화)
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // 항상 새 위젯 인스턴스 생성
        console.log('🔵 결제위젯 초기화 시작');
        const initStart = performance.now();
        
        // 타임아웃 설정 (10초 이상 걸리면 재시도)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('위젯 초기화 타임아웃')), 10000);
        });
        
        const widgets = await Promise.race([
          initPaymentWidget(orderData.customerKey),
          timeoutPromise
        ]) as any;
        
        const initTime = Math.round(performance.now() - initStart);
        console.log(`✅ 결제위젯 초기화 완료 (${initTime}ms)`);
        
        // 결제 금액 설정
        await widgets.setAmount({
          currency: "KRW",
          value: orderData.amount,
        });

        // 결제 UI 순차 렌더링 (점진적 표시)
        console.log('🔵 결제 UI 렌더링 시작');
        const uiStart = performance.now();
        
        // 결제 수단 먼저 렌더링
        console.log('🔵 결제 수단 렌더링 중...');
        const methodStart = performance.now();
        await widgets.renderPaymentMethods({
          selector: "#payment-method",
          variantKey: "DEFAULT",
        });
        const methodTime = Math.round(performance.now() - methodStart);
        console.log(`✅ 결제 수단 렌더링 완료 (${methodTime}ms)`);
        
        // 약관 렌더링
        console.log('🔵 약관 렌더링 중...');
        const agreementStart = performance.now();
        await widgets.renderAgreement({
          selector: "#agreement",
          variantKey: "AGREEMENT",
        });
        const agreementTime = Math.round(performance.now() - agreementStart);
        console.log(`✅ 약관 렌더링 완료 (${agreementTime}ms)`);
        
        const uiTime = Math.round(performance.now() - uiStart);
        
        // 위젯 인스턴스 저장
        widgetInstanceRef.current = widgets;
        setPaymentWidgets(widgets);
        setIsWidgetRendered(true);
        
        const totalTime = Math.round(performance.now() - renderStart);
        console.log(`✅ 결제위젯 렌더링 완료 - UI: ${uiTime}ms, 총: ${totalTime}ms`);

      } catch (error: any) {
        console.error('결제위젯 렌더링 오류:', error);
        
        // 모든 에러에 대해 처리
        const errorMsg = error.message || '';
        
        if (errorMsg.includes('타임아웃')) {
          toast.error('네트워크가 느립니다. 다시 시도하고 있습니다...');
          
          // 타임아웃 시 한 번 더 재시도
          try {
            console.log('🔄 결제위젯 재시도 시작');
            const retryStart = performance.now();
            const widgets = await initPaymentWidget(orderData.customerKey);
            const retryTime = Math.round(performance.now() - retryStart);
            console.log(`✅ 결제위젯 재시도 성공 (${retryTime}ms)`);
            
            await widgets.setAmount({
              currency: "KRW",
              value: orderData.amount,
            });

            await Promise.all([
              widgets.renderPaymentMethods({
                selector: "#payment-method",
                variantKey: "DEFAULT",
              }),
              widgets.renderAgreement({
                selector: "#agreement",
                variantKey: "AGREEMENT",
              }),
            ]);

            widgetInstanceRef.current = widgets;
            setPaymentWidgets(widgets);
            setIsWidgetRendered(true);
            
            toast.success('결제 화면을 불러왔습니다.');
            return;
          } catch (retryError) {
            console.error('결제위젯 재시도 실패:', retryError);
            toast.error('네트워크 연결을 확인해주세요.');
          }
        } else if (errorMsg.includes('하나의') || errorMsg.includes('알 수 없는')) {
          toast.error('결제 화면 준비 중입니다. 잠시 후 다시 시도해주세요.');
        } else {
          toast.error('결제 화면을 불러오는데 실패했습니다.');
        }
        
        // DOM과 상태 완전 초기화
        const paymentMethodEl = document.querySelector("#payment-method");
        const agreementEl = document.querySelector("#agreement");
        if (paymentMethodEl) paymentMethodEl.innerHTML = '';
        if (agreementEl) agreementEl.innerHTML = '';
        
        widgetInstanceRef.current = null;
        setIsWidgetRendered(false);
        setPaymentWidgets(null);
        
        // Step 1로 복귀
        setTimeout(() => {
          navigate(`/payment/${storeId}`, { replace: true });
        }, 1000);
      }
    };

    renderPaymentWidget();
  }, [step, storeId, navigate, isWidgetRendered, paymentWidgets]);

  // 실제 매장명 조회 및 브랜드 설정 (Main 페이지에서 넘어온 매장명 매칭)
  useEffect(() => {
    const fetchStoreName = async () => {
      if (!storeId) {
        setActualStoreName("매장");
        setStoreBrand("");
        return;
      }

      try {
        // 1. localStorage에서 매장 정보 확인 (전체 목록 키 우선, 없으면 표시용 배치)
        const storedStores =
          localStorage.getItem("nearbyStoresFull") || localStorage.getItem("nearbyStores");
        if (storedStores) {
          try {
            const stores = JSON.parse(storedStores);
            // storeId와 정확히 일치하는 매장 찾기
            const store = stores.find((s: any) => String(s.id) === String(storeId));
            if (store) {
              if (store.name) {
                setActualStoreName(store.name);
              }
              // 매장의 image 필드를 브랜드명으로 변환
              if (store.image && storeNames[store.image]) {
                setStoreBrand(storeNames[store.image]);
              } else if (store.image) {
                // storeNames에 없는 경우 image 값을 그대로 사용 (한글인 경우)
                setStoreBrand(store.image);
              }
              return;
            }
          } catch (e) {
            console.error("localStorage 파싱 오류:", e);
          }
        }

        // 2. storeNames에서 브랜드명 매핑 확인 - 우선순위 2
        if (storeNames[storeId]) {
          setActualStoreName(storeNames[storeId]);
          setStoreBrand(storeNames[storeId]);
          return;
        }

        // 3. 기본값
        setActualStoreName("매장");
        setStoreBrand("");
      } finally {
        setIsStoreNameLoaded(true);
      }
    };

    fetchStoreName();
  }, [storeId]);

  // 프랜차이즈 및 매장 정보 조회 (병렬 처리로 최적화)
  useEffect(() => {
    const fetchFranchiseAndStoreInfo = async () => {
      if (!storeBrand) {
        // 브랜드 정보가 없어도 매장 정보는 기본값으로 설정하여 로딩이 완료될 수 있도록 함
        setStoreInfo({
          gifticon_available: false,
          local_currency_available: false,
          local_currency_discount_rate: null,
          parking_available: false,
          free_parking: false,
          parking_size: null,
        });
        setIsLoadingPaymentMethods(false);
        setIsLoadingStoreInfo(false);
        return;
      }

      setIsLoadingStoreInfo(true);

      try {
        // 1. 프랜차이즈 정보 조회
        const franchisePromise = supabase
          .from('franchises' as any)
          .select('id')
          .eq('name', storeBrand)
          .single();

        // 2. storeId가 UUID인 경우, 매장 정보를 병렬로 조회
        const isUUID = storeId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId) : false;
        
        let storePromise = null;
        if (storeId && isUUID) {
          // UUID인 경우 프랜차이즈 정보와 병렬로 매장 정보 조회
          storePromise = supabase
            .from('stores' as any)
            .select('gifticon_available, local_currency_available, local_currency_discount_rate, parking_available, free_parking, parking_size')
            .eq('id', storeId)
            .single();
        }

        // 프랜차이즈 정보와 매장 정보를 병렬로 기다림
        const [franchiseResult, storeResult] = await Promise.all([
          franchisePromise,
          storePromise
        ]);

        const { data: franchiseData, error: franchiseError } = franchiseResult;

        if (franchiseError && franchiseError.code !== 'PGRST116') {
          console.error("프랜차이즈 조회 오류:", franchiseError);
          setIsLoadingPaymentMethods(false);
          setIsLoadingStoreInfo(false);
          return;
        }

        if (franchiseData) {
          setFranchiseId(franchiseData.id);

          // 결제 방식 조회
          const { data: paymentMethodsData, error: paymentMethodsError } = await supabase
            .from('franchise_payment_methods' as any)
            .select('method_name, method_type, rate')
            .eq('franchise_id', franchiseData.id);

          if (paymentMethodsError) {
            console.error("결제 방식 조회 오류:", paymentMethodsError);
            setIsLoadingPaymentMethods(false);
          } else if (paymentMethodsData) {
            setFranchisePaymentMethods(paymentMethodsData.map((pm: any) => ({
              method_name: pm.method_name,
              method_type: pm.method_type,
              rate: pm.rate,
            })));
            setIsLoadingPaymentMethods(false);
          } else {
            setIsLoadingPaymentMethods(false);
          }
        } else {
          // 프랜차이즈 데이터가 없는 경우 (DB에 등록되지 않은 브랜드)
          setFranchiseId(null);
          setFranchisePaymentMethods([]);
          setIsLoadingPaymentMethods(false);
        }

        // 매장 정보 처리
        if (storeId) {
          if (isUUID && storeResult) {
            // UUID인 경우, 이미 병렬로 가져온 결과 사용
            const { data: storeData, error: storeError } = storeResult;
            if (!storeError && storeData) {
              setStoreInfo({
                gifticon_available: storeData.gifticon_available || false,
                local_currency_available: storeData.local_currency_available || false,
                local_currency_discount_rate: storeData.local_currency_discount_rate || null,
                parking_available: storeData.parking_available || false,
                free_parking: storeData.free_parking || false,
                parking_size: storeData.parking_size,
              });
            } else {
              // 매장 정보가 없거나 오류인 경우 기본값
              setStoreInfo({
                gifticon_available: false,
                local_currency_available: false,
                local_currency_discount_rate: null,
                parking_available: false,
                free_parking: false,
                parking_size: null,
              });
            }
            setIsLoadingStoreInfo(false);
          } else if (!isUUID && franchiseData) {
            // 숫자인 경우, franchise_id로 조회
            const { data: storeData, error: storeError } = await supabase
              .from('stores' as any)
              .select('gifticon_available, local_currency_available, local_currency_discount_rate, parking_available, free_parking, parking_size')
              .eq('franchise_id', franchiseData.id)
              .limit(1)
              .single();

            if (!storeError && storeData) {
              setStoreInfo({
                gifticon_available: storeData.gifticon_available || false,
                local_currency_available: storeData.local_currency_available || false,
                local_currency_discount_rate: storeData.local_currency_discount_rate || null,
                parking_available: storeData.parking_available || false,
                free_parking: storeData.free_parking || false,
                parking_size: storeData.parking_size,
              });
            } else {
              // 매장 정보가 없거나 오류인 경우 기본값
              setStoreInfo({
                gifticon_available: false,
                local_currency_available: false,
                local_currency_discount_rate: null,
                parking_available: false,
                free_parking: false,
                parking_size: null,
              });
            }
            setIsLoadingStoreInfo(false);
          } else {
            // 그 외의 경우 (franchiseData가 없거나 storeId가 숫자가 아닌 경우 등) 기본값
            setStoreInfo({
              gifticon_available: false,
              local_currency_available: false,
              local_currency_discount_rate: null,
              parking_available: false,
              free_parking: false,
              parking_size: null,
            });
            setIsLoadingStoreInfo(false);
          }
        } else {
          // storeId가 없는 경우 기본값
          setStoreInfo({
            gifticon_available: false,
            local_currency_available: false,
            local_currency_discount_rate: null,
            parking_available: false,
            free_parking: false,
            parking_size: null,
          });
          setIsLoadingStoreInfo(false);
        }
      } catch (error) {
        console.error("프랜차이즈/매장 정보 조회 오류:", error);
        setIsLoadingPaymentMethods(false);
        setIsLoadingStoreInfo(false);
      }
    };

    fetchFranchiseAndStoreInfo();
  }, [storeBrand, storeId]);

  // 기프티콘 사용 가능 여부 계산 (결제 방식 생성 및 useEffect에서 사용)
  const isGifticonAvailable = storeInfo?.gifticon_available || false;
  const hasGifticons = gifticons.length > 0;
  const canUseGifticon = isGifticonAvailable && hasGifticons;

  // 동적 결제 방식 생성 (프랜차이즈 결제 방식 + 기프티콘 분리)
  const paymentMethods = useMemo(() => {
    const methods: Array<{
      id: string;
      name: string;
      enabled: boolean;
      type: 'membership' | 'gifticon' | 'local_currency' | 'combined';
      method_type?: string | null;
      rate?: number | null;
      gifticonDiscount?: number;
      description?: string;
    }> = [];

    // 기프티콘 사용 가능 여부 및 최대 할인율 (이미 상단에서 계산됨)

    // 프랜차이즈별 결제 방식 추가 (기프티콘과 분리)
    // 멤버십 결제 방식은 목록에서 제외

    // 기프티콘 결제 방식 추가 (항상 별도로 표시)
    if (canUseGifticon) {
      methods.push({
        id: 'method-gifticon',
        name: '기프티콘',
        enabled: true,
        type: 'gifticon',
        gifticonDiscount: maxGifticonDiscount,
        description: `기프티콘 ${maxGifticonDiscount}% 할인`,
      });
    }

    // 지역화폐 사용 가능 여부에 따라 지역화폐 옵션 추가
    if (storeInfo?.local_currency_available) {
      const discountRate = storeInfo.local_currency_discount_rate;
      const description = discountRate 
        ? `지역화폐 ${discountRate}% 할인`
        : "지역화폐 사용";
      
      methods.push({
        id: 'method-local-currency',
        name: '지역화폐',
        enabled: true,
        type: 'local_currency',
        description: description,
      });
    }

    // 초기 로딩 중이면 빈 배열 반환 (화면에 아무것도 표시하지 않음)
    if (isInitialLoading) {
      return [];
    }

    // 기본값 제거: 로딩 중이거나 정보가 없으면 빈 배열 반환
    // 프랜차이즈 정보가 로딩 중이거나 없는 경우 빈 배열 반환하여 기본값이 표시되지 않도록 함
    if (isLoadingPaymentMethods || (methods.length === 0 && !storeInfo)) {
      return [];
    }

    return methods;
  }, [franchisePaymentMethods, storeInfo, gifticons, maxGifticonDiscount, isLoadingPaymentMethods, isInitialLoading]);


  // 결제 방식 추천 ID 계산 (할인율이 가장 높은 것)
  const recommendedMethodId = useMemo(() => {
    if (paymentMethods.length === 0) return null;
    
    let bestId = null;
    let maxRate = -1;

    // 추천 순위: 1. 할인율이 높은 것, 2. 할인율이 같다면 기프티콘 우선
    paymentMethods.forEach((method) => {
      if (!method.enabled) return;
      if (method.type === 'membership') return; // 멤버십은 추천에서 제외

      let currentRate = 0;
      if (method.type === 'gifticon' && method.gifticonDiscount) {
        currentRate = method.gifticonDiscount;
      } else if (method.type === 'local_currency') {
        currentRate = storeInfo?.local_currency_discount_rate || 0;
      }

      // 할인율이 높거나, 같을 경우 기프티콘을 우선적으로 추천
      if (currentRate > maxRate || (currentRate === maxRate && method.type === 'gifticon')) {
        maxRate = currentRate;
        bestId = method.id;
      }
    });

    // 모든 할인율이 0이거나 추천 대상을 못 찾은 경우 첫 번째 결제 수단 선택
    if (!bestId && paymentMethods.length > 0) {
      const firstValid = paymentMethods.find(m => m.enabled && m.type !== 'membership');
      if (firstValid) bestId = firstValid.id;
    }

    return bestId;
  }, [paymentMethods, storeInfo]);

  // 결제 방식 자동 선택 (할인율이 가장 높은 것)
  useEffect(() => {
    if (!isInitialLoading && recommendedMethodId && !hasUserSelectedPaymentMethodManually) {
      setSelectedPaymentOptions(new Set([recommendedMethodId]));
    }
  }, [recommendedMethodId, hasUserSelectedPaymentMethodManually, isInitialLoading]);

  // 이전 로그인 상태를 추적하기 위한 ref 사용
  const prevSessionRef = useMemo(() => ({ current: null as any }), []);

  // 총 선택한 금액 계산 (결제 완료된 기프티콘 제외, 할인쿠폰 적용 전)
  const totalCostBeforeCoupon = Array.from(selectedGifticons.values())
    .reduce((sum, item) => {
      // 이미 결제 완료된 기프티콘은 제외
      if (completedPurchases.has(item.reservedId)) {
        return sum;
      }
      return sum + item.sale_price;
    }, 0);

  // 할인쿠폰 로드 및 자동 최대 할인 적용
  useEffect(() => {
    const loadCoupons = async () => {
      if (!isLoggedIn) return;
      
      try {
        // 예시 쿠폰 데이터 (실제로는 DB에서 조회)
        const now = new Date();
        const exampleCoupons: Coupon[] = [
          {
            id: '1',
            name: '신규 가입 쿠폰',
            description: '3,000원 할인',
            discount_type: 'fixed',
            discount_value: 3000,
            min_purchase_amount: null,
            expiry_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'available',
          },
          {
            id: '2',
            name: '생일 축하 쿠폰',
            description: '5,000원 할인',
            discount_type: 'fixed',
            discount_value: 5000,
            min_purchase_amount: 20000,
            expiry_date: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'available',
          },
          {
            id: '3',
            name: '이벤트 쿠폰',
            description: '15% 할인',
            discount_type: 'percent',
            discount_value: 15,
            min_purchase_amount: 30000,
            expiry_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'available',
          },
        ];

        // 사용 가능한 쿠폰만 필터링
        const available = exampleCoupons.filter(c => {
          const expiryDate = new Date(c.expiry_date);
          return expiryDate >= now && c.status === 'available';
        });

        setAvailableCoupons(available);
      } catch (error) {
        console.error("할인쿠폰 로딩 오류:", error);
      }
    };

    if (isLoggedIn) {
      loadCoupons();
    }
  }, [isLoggedIn]);

  // 자동으로 최적 쿠폰 선택 (접혀있을 때만 자동 적용)
  useEffect(() => {
    // 펼쳐져 있으면 자동 선택하지 않음 (사용자가 직접 선택)
    if (isCouponExpanded) {
      return;
    }

    if (availableCoupons.length === 0 || totalCostBeforeCoupon === 0) {
      setSelectedCoupon(null);
      return;
    }

    const now = new Date();
    
    // 사용 가능한 쿠폰만 필터링
    const usableCoupons = availableCoupons.filter(coupon => {
      // 최소 구매 금액 체크
      if (coupon.min_purchase_amount && totalCostBeforeCoupon < coupon.min_purchase_amount) {
        return false;
      }

      // 만료일 체크
      const expiryDate = new Date(coupon.expiry_date);
      if (expiryDate < now) {
        return false;
      }

      return true;
    });

    if (usableCoupons.length === 0) {
      setSelectedCoupon(null);
      return;
    }

    // 정렬: 1순위 유효기한 임박 순, 2순위 할인율 순
    const sortedCoupons = [...usableCoupons].sort((a, b) => {
      // 1순위: 유효기한 임박 순 (만료일이 가까운 순)
      const expiryA = new Date(a.expiry_date).getTime();
      const expiryB = new Date(b.expiry_date).getTime();
      if (expiryA !== expiryB) {
        return expiryA - expiryB; // 오름차순 (임박한 것 먼저)
      }

      // 2순위: 할인율 순 (할인율이 높은 순)
      // 할인율 계산 (퍼센트는 discount_value, 고정금액은 대략적인 할인율 추정)
      const getDiscountRate = (coupon: Coupon): number => {
        if (coupon.discount_type === 'percent') {
          return coupon.discount_value;
        } else {
          // 고정금액의 경우 대략적인 할인율 추정 (최소 구매 금액 기준)
          if (coupon.min_purchase_amount) {
            return (coupon.discount_value / coupon.min_purchase_amount) * 100;
          }
          return 0;
        }
      };

      const rateA = getDiscountRate(a);
      const rateB = getDiscountRate(b);
      return rateB - rateA; // 내림차순 (할인율 높은 것 먼저)
    });

    // 가장 우선순위가 높은 쿠폰 선택
    setSelectedCoupon(sortedCoupons[0]);
  }, [availableCoupons, totalCostBeforeCoupon, isCouponExpanded]);

  // 로그인 상태 확인
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const loggedIn = !!session;
      setIsLoggedIn(loggedIn);

      // 초기 세션 상태 저장
      prevSessionRef.current = session;

      // 결제 이력 확인
      if (loggedIn && session?.user) {
        try {
          const { data: paymentHistory, error: paymentError } = await supabase
            .from('payment_history')
            .select('id')
            .eq('user_id', session.user.id)
            .limit(1);

          const paymentHistoryExists = !paymentError && paymentHistory && paymentHistory.length > 0;
          setHasPaymentHistory(paymentHistoryExists);
        } catch (error) {
          console.error("결제 이력 확인 오류:", error);
        }
      }

    };
    checkAuth();
  }, []);

  // 세션 만료 감지 및 로그아웃 처리
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const wasLoggedIn = !!prevSessionRef.current;
      const isNowLoggedIn = !!session;
      
      if (event === "INITIAL_SESSION" && !session && wasLoggedIn) {
        setIsLoggedIn(false);
        prevSessionRef.current = null;
        return;
      }

      if (event === "SIGNED_OUT" || (!session && wasLoggedIn)) {
        setIsLoggedIn(false);
      } else if (event === "SIGNED_IN" || (session && isNowLoggedIn)) {
        // 로그인되거나 토큰이 갱신된 경우
        setIsLoggedIn(true);
      }
      
      // 현재 세션 상태 저장
      prevSessionRef.current = session;
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);


  // 초기 데이터 로딩 완료 체크
  useEffect(() => {
    // 이미 초기 데이터가 로드되었으면 더 이상 체크하지 않음
    if (hasInitialDataLoaded) {
      return;
    }

    // 결제 방식 로딩이 완료되지 않았으면 대기
    if (isLoadingPaymentMethods) {
      return;
    }

    // 매장 정보 로딩이 완료되지 않았으면 대기
    if (isLoadingStoreInfo) {
      return;
    }

    // 브랜드명 로딩이 완료되지 않았으면 대기
    if (!isStoreNameLoaded) {
      return;
    }

    // storeInfo가 null이면 아직 매장 정보를 불러오는 중 (isLoadingStoreInfo가 false인데도 null이면 오류 상황이거나 기본값 설정 전임)
    if (storeInfo === null) {
      return;
    }

    // 기프티콘 로딩 상태 확인
    // 기프티콘이 사용 가능한 경우, 기프티콘 로딩이 완료될 때까지 대기
    if (storeInfo.gifticon_available && isLoading) {
      return;
    }

    // 모든 로딩이 완료되면 초기 로딩 종료
    console.log('✅ 모든 데이터 로딩 완료');
    setHasInitialDataLoaded(true);
    setIsInitialLoading(false);
  }, [storeBrand, isLoadingPaymentMethods, isLoadingStoreInfo, isLoading, storeInfo, hasInitialDataLoaded, isStoreNameLoaded]);


  // 기프티콘 목록 조회 (브랜드별 필터링 및 천원대별 중복 제거, 할인율 순 정렬)
  useEffect(() => {
    const fetchGifticons = async () => {
      if (!isLoggedIn) {
        setIsLoading(false);
        return;
      }

      if (!storeBrand) {
        // 브랜드 정보가 없으면 기프티콘 조회하지 않음
        setGifticons([]);
        setGifticonsByPriceRange(new Map());
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setGifticons([]);
          setGifticonsByPriceRange(new Map());
          return;
        }

        // 먼저 이미 내가 예약한 대기중 기프티콘 조회
        const { data: existingPending, error: existingError } = await supabase
          .from('used_gifticons')
          .select('*')
          .eq('status', '대기중')
          .eq('available_at', storeBrand)
          .eq('reserved_by', session.user.id);

        if (existingError) throw existingError;

        // 이미 대기중인 기프티콘이 있고 천원대별로 하나씩 이상 있으면 그것만 표시
        if (existingPending && existingPending.length > 0) {
          // 할인효율 기준으로 한 번 정렬 (DB 레벨에서는 계산식 정렬이 불가능하므로 클라이언트에서 정렬)
          const sortedPending = [...existingPending].sort(sortByDiscountEfficiency);

          // 천원대별로 그룹화하면서 할인효율이 높은 순으로 이미 정렬된 데이터를 사용
          const existingGroupedByThousand = new Map<number, UsedGifticon>();
          sortedPending.forEach((item) => {
            const priceRange = getPriceRange(item.original_price);
            // 같은 천원대에 아직 항목이 없으면 추가 (이미 할인효율 순으로 정렬되어 있으므로 첫 번째가 최고 효율)
            if (!existingGroupedByThousand.has(priceRange)) {
              existingGroupedByThousand.set(priceRange, item);
            }
          });

          // 그룹화된 항목들을 배열로 변환 (이미 할인효율 순으로 정렬됨)
          const selectedGifticons: UsedGifticon[] = Array.from(existingGroupedByThousand.values());

          // 불러온 순서 추적 및 초기 기프티콘 ID 저장
          const initialIds = new Set<string>();
          const loadOrder = new Map<string, number>();
          selectedGifticons.forEach((gifticon) => {
            initialIds.add(gifticon.id);
            loadOrder.set(gifticon.id, loadOrderCounter.current++);
          });

          // 정렬: 작은 금액순(판매가 오름차순)
          selectedGifticons.sort((a, b) => a.sale_price - b.sale_price);

          setGifticons(selectedGifticons);
          setInitialGifticonIds(initialIds);
          setGifticonLoadOrder(loadOrder);
          updateGifticonsByPriceRange(selectedGifticons);
          setIsLoading(false);
          return;
        }

        // 대기중인 기프티콘이 없거나 없는 천원대가 있으면 판매중에서 가져오기
        const { data: allData, error: fetchError } = await supabase
          .from('used_gifticons')
          .select('*')
          .eq('status', '판매중')
          .eq('available_at', storeBrand);

        if (fetchError) throw fetchError;

        if (!allData || allData.length === 0) {
          setGifticons([]);
          setGifticonsByPriceRange(new Map());
          setIsLoading(false);
          return;
        }

        // 할인효율 기준으로 한 번 정렬 (DB 레벨에서는 계산식 정렬이 불가능하므로 클라이언트에서 정렬)
        const sortedData = [...allData].sort(sortByDiscountEfficiency);

        // 천원대별로 그룹화하면서 할인효율이 높은 순으로 이미 정렬된 데이터를 사용
        const groupedByThousand = new Map<number, UsedGifticon>();
        sortedData.forEach((item) => {
          const priceRange = getPriceRange(item.original_price);
          // 같은 천원대에 아직 항목이 없으면 추가 (이미 할인효율 순으로 정렬되어 있으므로 첫 번째가 최고 효율)
          if (!groupedByThousand.has(priceRange)) {
            groupedByThousand.set(priceRange, item);
          }
        });

        // 그룹화된 항목들을 배열로 변환 (이미 할인효율 순으로 정렬됨)
        const displayGifticons: UsedGifticon[] = Array.from(groupedByThousand.values());
        for (const gifticon of displayGifticons) {
          // 각 천원대의 첫 번째 기프티콘만 대기중으로 변경
          const { error: reserveError } = await supabase
            .from('used_gifticons')
            .update({
              status: '대기중',
              reserved_by: session.user.id,
              reserved_at: new Date().toISOString()
            })
            .eq('id', gifticon.id)
            .eq('status', '판매중'); // 판매중인 것만 대기중으로 변경

          if (reserveError) {
            console.error("기프티콘 예약 오류:", reserveError);
          }
        }

        // 대기중으로 변경된 기프티콘 조회 (내가 예약한 것만)
        const { data, error } = await supabase
          .from('used_gifticons')
          .select('*')
          .eq('status', '대기중')
          .eq('available_at', storeBrand)
          .eq('reserved_by', session.user.id);

        if (error) throw error;

        if (data) {
          // 할인효율 기준으로 한 번 정렬 (DB 레벨에서는 계산식 정렬이 불가능하므로 클라이언트에서 정렬)
          const sortedData = [...data].sort(sortByDiscountEfficiency);

          // 천원대별로 그룹화하면서 할인효율이 높은 순으로 이미 정렬된 데이터를 사용
          const finalGroupedByThousand = new Map<number, UsedGifticon>();
          sortedData.forEach((item) => {
            const priceRange = getPriceRange(item.original_price);
            // 같은 천원대에 아직 항목이 없으면 추가 (이미 할인효율 순으로 정렬되어 있으므로 첫 번째가 최고 효율)
            if (!finalGroupedByThousand.has(priceRange)) {
              finalGroupedByThousand.set(priceRange, item);
            }
          });

          // 그룹화된 항목들을 배열로 변환 (이미 할인효율 순으로 정렬됨)
          const finalGifticons: UsedGifticon[] = Array.from(finalGroupedByThousand.values());

          // 불러온 순서 추적 및 초기 기프티콘 ID 저장
          const initialIds = new Set<string>();
          const loadOrder = new Map<string, number>();
          finalGifticons.forEach((gifticon) => {
            initialIds.add(gifticon.id);
            loadOrder.set(gifticon.id, loadOrderCounter.current++);
          });

          // 정렬: 작은 금액순(판매가 오름차순)
          finalGifticons.sort((a, b) => a.sale_price - b.sale_price);

          setGifticons(finalGifticons);
          setInitialGifticonIds(initialIds);
          setGifticonLoadOrder(loadOrder);
          updateGifticonsByPriceRange(finalGifticons);
        } else {
          setGifticons([]);
          setGifticonsByPriceRange(new Map());
        }
      } catch (error: any) {
        console.error("기프티콘 조회 오류:", error);
        toast.error("기프티콘을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchGifticons();
  }, [isLoggedIn, storeBrand]);

  // 페이지 언마운트 시 모든 대기중 기프티콘을 판매중으로 복구
  useEffect(() => {
    return () => {
      if (!isLoggedIn) return;

      const releaseAllReservedGifticons = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || !storeBrand) return;

        // 해당 사용자가 예약한 해당 브랜드의 대기중 기프티콘을 판매중으로 복구
        await supabase
          .from('used_gifticons')
          .update({ 
            status: '판매중',
            reserved_by: null,
            reserved_at: null
          })
          .eq('available_at', storeBrand)
          .eq('status', '대기중')
          .eq('reserved_by', session.user.id);
      };

      releaseAllReservedGifticons();
    };
  }, [isLoggedIn, storeBrand]);

  // Step1에서 타이머 카운트다운
  useEffect(() => {
    if (step !== 1 || !isLoggedIn || !storeBrand) {
      setRemainingTime(60); // step이 변경되면 타이머 리셋
      return;
    }

    setRemainingTime(60); // step 1 진입시 타이머 초기화

    const intervalId = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [step, isLoggedIn, storeBrand]);

  // Step1에서 1분 이상 머무르면 main으로 이동하고 대기중 기프티콘 복구
  useEffect(() => {
    if (step !== 1 || !isLoggedIn || !storeBrand) return;

    const timeoutId = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // 대기중 기프티콘을 판매중으로 복구
      await supabase
        .from('used_gifticons')
        .update({ 
          status: '판매중',
          reserved_by: null,
          reserved_at: null
        })
        .eq('available_at', storeBrand)
        .eq('status', '대기중')
        .eq('reserved_by', session.user.id);

      // main으로 이동
      navigate('/main');
    }, 60000); // 1분 = 60초

    return () => {
      clearTimeout(timeoutId);
    };
  }, [step, isLoggedIn, storeBrand, navigate]);


  // 모든 하위 기프티콘 ID를 재귀적으로 수집하는 헬퍼 함수
  const getAllDescendantGifticonIds = (parentId: string, relations: Map<string, string>): string[] => {
    const descendantIds: string[] = [];
    
    // 직접 자식 찾기
    relations.forEach((pId, addedId) => {
      if (pId === parentId) {
        descendantIds.push(addedId);
        // 재귀적으로 자식의 자식도 찾기
        const grandchildren = getAllDescendantGifticonIds(addedId, relations);
        descendantIds.push(...grandchildren);
      }
    });
    
    return descendantIds;
  };

  // 확인 버튼 클릭 시 DB에서 기프티콘 조회 후 자동 선택
  const executeAutoSelect = async () => {
    if (!inputBudget || inputBudget <= 0 || !canUseGifticon) {
      toast.error("금액을 입력해주세요.");
      return;
    }

    if (!isLoggedIn || !storeBrand) {
      toast.error("세션이 필요합니다.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error("세션이 필요합니다.");
      return;
    }

    // 모든 기존 대기중 기프티콘을 판매중으로 복구 (모드 전환 시 완전 초기화)
    try {
      // 선택된 기프티콘 중 대기중인 것들을 판매중으로 복구
      const reservedIds: string[] = [];
      selectedGifticons.forEach((selected) => {
        reservedIds.push(selected.reservedId);
      });

      if (reservedIds.length > 0) {
        await supabase
          .from('used_gifticons')
          .update({
            status: '판매중',
            reserved_by: null,
            reserved_at: null
          })
          .in('id', reservedIds);
      }

      // 기존 추천 기프티콘 중 대기중인 것들도 판매중으로 복구
      const initialReservedIds: string[] = [];
      gifticons.forEach((gifticon) => {
        initialReservedIds.push(gifticon.id);
      });

      if (initialReservedIds.length > 0) {
        await supabase
          .from('used_gifticons')
          .update({
            status: '판매중',
            reserved_by: null,
            reserved_at: null
          })
          .eq('available_at', storeBrand)
          .eq('status', '대기중')
          .in('id', initialReservedIds);
      }
    } catch (error) {
      console.error("기존 기프티콘 상태 복구 오류:", error);
    }

    // 기존 선택 및 상태 완전 초기화 (추천 모드 정보 모두 제거)
    setSelectedGifticons(new Map());
    setAddedGifticonRelations(new Map());
    setInitialGifticonIds(new Set());
    setGifticonLoadOrder(new Map());
    // 추천 기프티콘 목록은 유지하여 자동선택 모드에서도 기프티콘 섹션이 보이도록 함
    setIsLoading(true);

    try {
      // DB에서 자동선택용 기프티콘 새로 조회 (추천 기프티콘과 별도로)
      const { data: autoSelectData, error: fetchError } = await supabase
        .from('used_gifticons')
        .select('*')
        .eq('status', '판매중')
        .eq('available_at', storeBrand);

      if (fetchError) throw fetchError;

      if (!autoSelectData || autoSelectData.length === 0) {
        setIsLoading(false);
        toast.error("사용 가능한 기프티콘이 없습니다.");
        return;
      }

      // 할인효율 기준으로 정렬 (개수 제한 없이 최대로 선택하기 위해 천원대별 그룹화 제거)
      const sortedData = [...autoSelectData].sort(sortByDiscountEfficiency);

      // 정렬된 모든 기프티콘을 대상으로 그리디 방식으로 예산 내에서 자동 선택
      const autoSelectList: UsedGifticon[] = sortedData;
      const selectedGifticonsMap = new Map<string, SelectedGifticon>();
      const autoSelectedList: UsedGifticon[] = []; // 자동선택된 기프티콘 목록 저장
      let remainingOriginalPriceBudget = inputBudget; // 총 기프티콘 금액권 예산
      let totalSalePrice = 0; // 총 구매 금액

      for (const gifticon of autoSelectList) {
        // original_price가 남은 예산을 넘지 않으면 선택 가능
        if (gifticon.original_price <= remainingOriginalPriceBudget) {
          const key = gifticon.id;
          if (!selectedGifticonsMap.has(key)) {
            // 대기중으로 변경
            const { error: reserveError } = await supabase
              .from('used_gifticons')
              .update({
                status: '대기중',
                reserved_by: session.user.id,
                reserved_at: new Date().toISOString()
              })
              .eq('id', gifticon.id);

            if (reserveError) {
              console.error(`기프티콘 예약 오류 (${gifticon.id}):`, reserveError);
              continue;
            }

            selectedGifticonsMap.set(key, {
              id: gifticon.id,
              sale_price: gifticon.sale_price,
              reservedId: gifticon.id
            });
            autoSelectedList.push(gifticon);
            remainingOriginalPriceBudget -= gifticon.original_price;
            totalSalePrice += gifticon.sale_price;
          }
        }
      }

      // 자동선택 모드로 전환
      setAutoSelectedGifticons(autoSelectedList);
      setSelectedGifticons(selectedGifticonsMap);
      setIsAutoSelectMode(true);
      setIsLoading(false);

      if (selectedGifticonsMap.size > 0) {
        toast.success(`${selectedGifticonsMap.size}개의 기프티콘이 자동으로 선택되었습니다.`);
      } else {
        toast.error("예산에 맞는 기프티콘을 찾을 수 없습니다.");
      }
    } catch (error: any) {
      console.error("자동선택 기프티콘 조회 오류:", error);
      toast.error("기프티콘을 불러오는 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  // 취소 버튼 클릭 시 선택된 기프티콘 해제 및 추천 기프티콘 다시 불러오기
  const cancelAutoSelect = async () => {
    if (!isLoggedIn || !storeBrand) {
      // 자동선택 모드 상태 초기화
      setSelectedGifticons(new Map());
      setAutoSelectedGifticons([]);
      setIsAutoSelectMode(false);
      setInputBudget(null);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      // 자동선택 모드 상태 초기화
      setSelectedGifticons(new Map());
      setAutoSelectedGifticons([]);
      setIsAutoSelectMode(false);
      setInputBudget(null);
      return;
    }

    try {
      // 자동선택 모드의 모든 대기중 기프티콘을 판매중으로 복구 (모드 전환 시 완전 초기화)
      const reservedIds: string[] = [];
      selectedGifticons.forEach((selected) => {
        reservedIds.push(selected.reservedId);
      });

      // 자동선택된 기프티콘 목록의 모든 항목도 복구
      autoSelectedGifticons.forEach((gifticon) => {
        if (!reservedIds.includes(gifticon.id)) {
          reservedIds.push(gifticon.id);
        }
      });

      if (reservedIds.length > 0) {
        await supabase
          .from('used_gifticons')
          .update({
            status: '판매중',
            reserved_by: null,
            reserved_at: null
          })
          .in('id', reservedIds);
      }
    } catch (error) {
      console.error("기프티콘 상태 복구 오류:", error);
    }

    // 자동선택 모드 상태 완전 초기화
    setSelectedGifticons(new Map());
    setAutoSelectedGifticons([]);
    setIsAutoSelectMode(false);
    setInputBudget(null);
    setAddedGifticonRelations(new Map());
    setInitialGifticonIds(new Set());
    setGifticonLoadOrder(new Map());

    // 추천 기프티콘 다시 불러오기
    setIsLoading(true);
    try {
      // 먼저 이미 내가 예약한 대기중 기프티콘 조회
      const { data: existingPending, error: existingError } = await supabase
        .from('used_gifticons')
        .select('*')
        .eq('status', '대기중')
        .eq('available_at', storeBrand)
        .eq('reserved_by', session.user.id);

      if (existingError) throw existingError;

      // 이미 대기중인 기프티콘이 있고 천원대별로 하나씩 이상 있으면 그것만 표시
      if (existingPending && existingPending.length > 0) {
          const sortedPending = [...existingPending].sort(sortByDiscountEfficiency);
          const existingGroupedByThousand = new Map<number, UsedGifticon>();
          sortedPending.forEach((item) => {
            const priceRange = getPriceRange(item.original_price);
            if (!existingGroupedByThousand.has(priceRange)) {
              existingGroupedByThousand.set(priceRange, item);
            }
          });

          const selectedGifticons: UsedGifticon[] = Array.from(existingGroupedByThousand.values());
          const initialIds = new Set<string>();
          const loadOrder = new Map<string, number>();
          selectedGifticons.forEach((gifticon) => {
            initialIds.add(gifticon.id);
            loadOrder.set(gifticon.id, loadOrderCounter.current++);
          });

          selectedGifticons.sort((a, b) => a.sale_price - b.sale_price);

          setGifticons(selectedGifticons);
          setInitialGifticonIds(initialIds);
          setGifticonLoadOrder(loadOrder);
          setIsLoading(false);
          return;
        }

      // 대기중인 기프티콘이 없거나 없는 천원대가 있으면 판매중에서 가져오기
      const { data: allData, error: fetchError } = await supabase
        .from('used_gifticons')
        .select('*')
        .eq('status', '판매중')
        .eq('available_at', storeBrand);

      if (fetchError) throw fetchError;

      if (!allData || allData.length === 0) {
        setGifticons([]);
        setIsLoading(false);
        return;
      }

      const sortedData = [...allData].sort(sortByDiscountEfficiency);
      const groupedByThousand = new Map<number, UsedGifticon>();
      sortedData.forEach((item) => {
        const priceRange = getPriceRange(item.original_price);
        if (!groupedByThousand.has(priceRange)) {
          groupedByThousand.set(priceRange, item);
        }
      });

      const displayGifticons: UsedGifticon[] = Array.from(groupedByThousand.values());
      for (const gifticon of displayGifticons) {
        const { error: reserveError } = await supabase
          .from('used_gifticons')
          .update({
            status: '대기중',
            reserved_by: session.user.id,
            reserved_at: new Date().toISOString()
          })
          .eq('id', gifticon.id)
          .eq('status', '판매중'); // 판매중인 것만 대기중으로 변경

        if (reserveError) {
          console.error("기프티콘 예약 오류:", reserveError);
        }
      }

      // 대기중으로 변경된 기프티콘 조회
      const { data, error } = await supabase
        .from('used_gifticons')
        .select('*')
        .eq('status', '대기중')
        .eq('available_at', storeBrand)
        .eq('reserved_by', session.user.id);

      if (error) throw error;

      if (data) {
        const sortedFinalData = [...data].sort(sortByDiscountEfficiency);
        const finalGroupedByThousand = new Map<number, UsedGifticon>();
        sortedFinalData.forEach((item) => {
          const priceRange = getPriceRange(item.original_price);
          if (!finalGroupedByThousand.has(priceRange)) {
            finalGroupedByThousand.set(priceRange, item);
          }
        });

        const finalGifticons: UsedGifticon[] = Array.from(finalGroupedByThousand.values());
        const initialIds = new Set<string>();
        const loadOrder = new Map<string, number>();
        finalGifticons.forEach((gifticon) => {
          initialIds.add(gifticon.id);
          loadOrder.set(gifticon.id, loadOrderCounter.current++);
        });

        finalGifticons.sort((a, b) => a.sale_price - b.sale_price);

        setGifticons(finalGifticons);
        setInitialGifticonIds(initialIds);
        setGifticonLoadOrder(loadOrder);
        updateGifticonsByPriceRange(finalGifticons);
      } else {
        setGifticons([]);
        setGifticonsByPriceRange(new Map());
      }
    } catch (error: any) {
      console.error("기프티콘 조회 오류:", error);
      toast.error("기프티콘을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };


  // 비슷한 가격대 기프티콘 추가 로드 (할인율 순)
  const loadSimilarPriceGifticons = async (selectedGifticon: UsedGifticon) => {
    if (!isLoggedIn || !storeBrand) return;
    
    // 자동선택 모드에서는 추가 로드하지 않음
    if (isAutoSelectMode) return;

    // 이미 이 기프티콘에 대한 추가 로드가 진행 중이면 중복 방지
    if (loadingGifticonIds.current.has(selectedGifticon.id)) {
      console.log(`[기프티콘 추가 로드] 이미 진행 중입니다: id=${selectedGifticon.id}`);
      return;
    }

    try {
      loadingGifticonIds.current.add(selectedGifticon.id);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        loadingGifticonIds.current.delete(selectedGifticon.id);
        return;
      }

      // 선택한 기프티콘의 original_price 기준으로 천원대 계산
      const selectedPriceRange = getPriceRange(selectedGifticon.original_price);
      
      console.log(`[기프티콘 추가 로드] 선택한 기프티콘: original_price=${selectedGifticon.original_price}, sale_price=${selectedGifticon.sale_price}, 천원대=${selectedPriceRange}`);
      
      // 현재 이미 불러온 기프티콘의 ID 목록 (중복 방지용)
      // 상태가 업데이트되기 전이므로 최신 상태를 확인하기 위해 getState 패턴 사용
      const existingGifticonIds = new Set<string>();
      gifticons.forEach(g => existingGifticonIds.add(g.id));
      
      // 같은 천원대의 새로운 기프티콘 조회 (original_price 기준)
      const priceMin = selectedPriceRange;
      const priceMax = selectedPriceRange + 999;

      console.log(`[기프티콘 추가 로드] 조회 범위: ${priceMin}원 ~ ${priceMax}원`);

      const { data: similarData, error: fetchError } = await supabase
        .from('used_gifticons')
        .select('*')
        .eq('status', '판매중')
        .eq('available_at', storeBrand)
        .gte('original_price', priceMin)
        .lte('original_price', priceMax);

      if (fetchError) {
        console.error("[기프티콘 추가 로드] 조회 오류:", fetchError);
        throw fetchError;
      }

      if (!similarData || similarData.length === 0) {
        console.log(`[기프티콘 추가 로드] 같은 천원대(${selectedPriceRange}원)의 판매중인 기프티콘이 없습니다.`);
        loadingGifticonIds.current.delete(selectedGifticon.id);
        return;
      }

      console.log(`[기프티콘 추가 로드] 조회된 기프티콘 수: ${similarData.length}`);

      // 이미 불러온 기프티콘 제외 (ID 기준)
      const newData = similarData.filter(item => 
        !existingGifticonIds.has(item.id)
      );

      console.log(`[기프티콘 추가 로드] 새로운 기프티콘 수: ${newData.length}`);

      if (newData.length === 0) {
        console.log(`[기프티콘 추가 로드] 같은 천원대(${selectedPriceRange}원)의 새로운 기프티콘이 없습니다.`);
        loadingGifticonIds.current.delete(selectedGifticon.id);
        return;
      }

      // 할인효율 기준으로 정렬
      newData.sort(sortByDiscountEfficiency);

      // 같은 천원대 내에서 할인효율이 높은 순으로 하나 선택
      const selectedGifticonToAdd = newData[0];

      console.log(`[기프티콘 추가 로드] 선택된 기프티콘: id=${selectedGifticonToAdd.id}, original_price=${selectedGifticonToAdd.original_price}, sale_price=${selectedGifticonToAdd.sale_price}, 할인율=${getDiscountRate(selectedGifticonToAdd.original_price, selectedGifticonToAdd.sale_price)}%`);

      // 선택한 기프티콘을 대기중으로 변경
      const { error: reserveError } = await supabase
        .from('used_gifticons')
        .update({
          status: '대기중',
          reserved_by: session.user.id,
          reserved_at: new Date().toISOString()
        })
        .eq('id', selectedGifticonToAdd.id);

      if (reserveError) {
        console.error("[기프티콘 추가 로드] 예약 오류:", reserveError);
        loadingGifticonIds.current.delete(selectedGifticon.id);
        return;
      }

      // 관계 맵에 추가 (추가된 기프티콘 ID -> 원본 기프티콘 ID)
      setAddedGifticonRelations(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedGifticonToAdd.id, selectedGifticon.id);
        return newMap;
      });

      // 불러온 순서 추가 (원본 기프티콘의 순서 다음으로 설정)
      loadOrderCounter.current++;
      const parentOrder = gifticonLoadOrder.get(selectedGifticon.id) ?? 0;
      // 원본 기프티콘 바로 다음 순서로 설정 (같은 가격대 내에서 원본 바로 아래 위치)
      const newOrder = parentOrder + 0.1; // 원본 바로 다음으로 배치하기 위해 소수점 사용

      setGifticonLoadOrder(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedGifticonToAdd.id, newOrder);
        return newMap;
      });

      // 기존 기프티콘 목록에 추가 (중복 체크)
      setGifticons(prev => {
        // 이미 존재하는 기프티콘인지 확인
        const alreadyExists = prev.some(g => g.id === selectedGifticonToAdd.id);
        if (alreadyExists) {
          console.log(`[기프티콘 추가 로드] 이미 존재하는 기프티콘입니다: id=${selectedGifticonToAdd.id}`);
          return prev; // 이미 있으면 추가하지 않음
        }

        const combined = [...prev, selectedGifticonToAdd];

        // 정렬: 1. 가격대별, 2. 같은 가격대일 경우 불러온 순서대로
        combined.sort((a, b) => {
          const priceRangeA = getPriceRange(a.original_price);
          const priceRangeB = getPriceRange(b.original_price);
          if (priceRangeA !== priceRangeB) {
            return priceRangeA - priceRangeB; // 가격대별 정렬
          }
          // 같은 가격대일 경우 불러온 순서대로
          const orderA = gifticonLoadOrder.get(a.id) ?? (a.id === selectedGifticonToAdd.id ? newOrder : 0);
          const orderB = gifticonLoadOrder.get(b.id) ?? (b.id === selectedGifticonToAdd.id ? newOrder : 0);
          return orderA - orderB;
        });
        
        // 금액대별 배열 업데이트
        updateGifticonsByPriceRange(combined);
        
        return combined;
      });

      console.log(`[기프티콘 추가 로드] 성공: ${selectedGifticonToAdd.original_price}원 기프티콘 추가됨`);
      loadingGifticonIds.current.delete(selectedGifticon.id);
    } catch (error: any) {
      console.error("[기프티콘 추가 로드] 전체 오류:", error);
      loadingGifticonIds.current.delete(selectedGifticon.id);
    }
  };

  // 기프티콘 선택/해제 토글
  const handleToggle = async (gifticon: UsedGifticon) => {
    const isSelected = selectedGifticons.has(gifticon.id);

    if (isSelected) {
      // 선택 해제
      const currentSelected = selectedGifticons.get(gifticon.id);
      if (!currentSelected) return;

      // 이미 결제 완료된 기프티콘인지 확인
      if (completedPurchases.has(currentSelected.reservedId)) {
        toast.error("이미 결제 완료된 기프티콘은 환불할 수 없습니다.");
        return;
      }

      if (!isLoggedIn) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      try {
        // 자동선택 모드에서는 간단하게 처리 (추가 기프티콘이 없으므로)
        if (isAutoSelectMode) {
          // 선택된 기프티콘을 판매중으로 복구
          const { error } = await supabase
            .from('used_gifticons')
            .update({
              status: '판매중',
              reserved_by: null,
              reserved_at: null
            })
            .eq('id', currentSelected.reservedId);

          if (error) throw error;

          // 선택 상태에서 제거 (화면은 유지)
          const newMap = new Map(selectedGifticons);
          newMap.delete(gifticon.id);
          setSelectedGifticons(newMap);

          toast.success("선택이 취소되었습니다.");
          return;
        }

        // 추천 모드에서의 처리 (금액대별 배열 기반)
        const priceRange = getPriceRange(gifticon.original_price);
        const samePriceRangeGifticons = gifticonsByPriceRange.get(priceRange) || [];
        
        // 같은 금액대에서 자신의 인덱스 찾기
        const currentIndex = samePriceRangeGifticons.findIndex(g => g.id === gifticon.id);
        
        if (currentIndex === -1) {
          // 같은 금액대에 없으면 선택 해제만 (자기 자신은 판매중으로 변경하지 않음)
          const newMap = new Map(selectedGifticons);
          newMap.delete(gifticon.id);
          setSelectedGifticons(newMap);
          
          toast.success("선택이 취소되었습니다.");
          return;
        }

        // 자신 이후에 불러온 기프티콘 중 선택되지 않은 것들을 찾기
        const gifticonsToRelease: string[] = [];
        const gifticonsToRemove: string[] = [];
        
        // 자신보다 먼저 불러온 기프티콘 중 선택 해제된 것이 있는지 확인
        let hasUnselectedEarlier = false;
        for (let i = 0; i < currentIndex; i++) {
          const earlierGifticon = samePriceRangeGifticons[i];
          const isEarlierSelected = Array.from(selectedGifticons.values())
            .some(selected => selected.id === earlierGifticon.id);
          
          if (!isEarlierSelected) {
            // 자신보다 먼저 불러온 기프티콘 중 선택 해제된 것이 있음
            hasUnselectedEarlier = true;
            break;
          }
        }
        
        // 자신보다 먼저 불러온 기프티콘 중 선택 해제된 것이 있으면 자신도 판매중으로 변경
        if (hasUnselectedEarlier) {
          gifticonsToRelease.push(currentSelected.reservedId);
          gifticonsToRemove.push(gifticon.id);
        }
        
        // 자신 이후에 불러온 기프티콘 중 선택되지 않은 것들만 처리
        for (let i = currentIndex + 1; i < samePriceRangeGifticons.length; i++) {
          const laterGifticon = samePriceRangeGifticons[i];
          const isLaterSelected = Array.from(selectedGifticons.values())
            .some(selected => selected.id === laterGifticon.id);
          
          if (!isLaterSelected) {
            // 선택되지 않은 이후 기프티콘은 판매중으로 변경
            gifticonsToRelease.push(laterGifticon.id);
            gifticonsToRemove.push(laterGifticon.id);
          }
        }

        // 판매중으로 복구
        if (gifticonsToRelease.length > 0) {
          const { error } = await supabase
            .from('used_gifticons')
            .update({
              status: '판매중',
              reserved_by: null,
              reserved_at: null
            })
            .in('id', gifticonsToRelease);

          if (error) throw error;
        }

        // 화면에서 제거 (자신보다 먼저 불러온 기프티콘이 선택 해제되었으면 자신도 제거, 자신 이후에 불러온 기프티콘도 제거)
        setGifticons(prev => {
          const remaining = prev.filter(g => {
            // 초기 로딩된 기프티콘은 항상 유지 (단, 자신보다 먼저 불러온 기프티콘이 선택 해제되어 자신도 제거 대상인 경우 제거)
            if (initialGifticonIds.has(g.id)) {
              // 자신보다 먼저 불러온 기프티콘이 선택 해제되어 자신도 제거 대상인 경우 제거
              if (gifticonsToRemove.includes(g.id)) return false;
              return true;
            }
            // 제거 대상 추가 기프티콘만 제거
            if (gifticonsToRemove.includes(g.id)) return false;
            // 나머지는 모두 유지
            return true;
          });

          // 정렬: 1. 가격대별, 2. 같은 가격대일 경우 불러온 순서대로
          remaining.sort((a, b) => {
            const priceRangeA = getPriceRange(a.original_price);
            const priceRangeB = getPriceRange(b.original_price);
            if (priceRangeA !== priceRangeB) {
              return priceRangeA - priceRangeB; // 가격대별 정렬
            }
            // 같은 가격대일 경우 불러온 순서대로
            const orderA = gifticonLoadOrder.get(a.id) ?? 0;
            const orderB = gifticonLoadOrder.get(b.id) ?? 0;
            return orderA - orderB;
          });

          // 금액대별 배열 업데이트
          updateGifticonsByPriceRange(remaining);

          return remaining;
        });

        // 관계 맵에서 제거 (제거된 기프티콘들의 관계)
        setAddedGifticonRelations(prev => {
          const newMap = new Map(prev);
          gifticonsToRemove.forEach(id => {
            // 제거된 기프티콘의 관계 삭제
            newMap.delete(id);
            // 제거된 기프티콘을 부모로 가진 관계도 삭제
            for (const [addedId, parentId] of newMap.entries()) {
              if (parentId === id) {
                newMap.delete(addedId);
              }
            }
          });
          return newMap;
        });

        // 선택 상태에서 제거
        const newMap = new Map(selectedGifticons);
        newMap.delete(gifticon.id);
        setSelectedGifticons(newMap);

        if (gifticonsToRemove.length > 0) {
          toast.success(`${gifticonsToRemove.length}개의 기프티콘이 제거되었습니다.`);
        } else {
          toast.success("선택이 취소되었습니다.");
        }
      } catch (error: any) {
        console.error("기프티콘 선택 해제 오류:", error);
        toast.error("선택 해제 중 오류가 발생했습니다.");
      }
    } else {
      // 선택
      // 자동선택 모드에서는 선택 추가 불가능 (선택 해제만 가능)
      if (isAutoSelectMode) {
        toast.error("자동선택 모드에서는 기프티콘을 추가로 선택할 수 없습니다.");
        return;
      }

      if (!isLoggedIn) {
        toast.error("세션이 필요합니다.");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("세션이 필요합니다.");
        return;
      }

      try {
        // 이미 대기중인 기프티콘이 있으면 그것 사용
        let reservedId = gifticon.id;

        // 현재 기프티콘이 이미 대기중인지 확인
        // 이미 화면에 표시된 기프티콘은 이미 대기중 상태이므로 그대로 사용
        if (gifticon.id) {
          reservedId = gifticon.id;
        } else {
          // 판매중인 기프티콘 중에서 하나 선택하여 대기중으로 변경
          const { data: availableItems, error: fetchError } = await supabase
            .from('used_gifticons')
            .select('id')
            .eq('status', '판매중')
            .eq('available_at', storeBrand)
            .eq('sale_price', gifticon.sale_price)
            .limit(1);

          if (!fetchError && availableItems && availableItems.length > 0) {
            reservedId = availableItems[0].id;
          } else {
            // 판매중인 기프티콘이 없으면 에러
            throw new Error("선택 가능한 기프티콘이 없습니다.");
          }
        }

        // 대기중으로 변경
        const { error: reserveError } = await supabase
          .from('used_gifticons')
          .update({
            status: '대기중',
            reserved_by: session.user.id,
            reserved_at: new Date().toISOString()
          })
          .eq('id', reservedId);

        if (reserveError) throw reserveError;

        // 선택 상태 업데이트
        setSelectedGifticons(new Map(selectedGifticons).set(gifticon.id, {
          id: gifticon.id,
          sale_price: gifticon.sale_price,
          reservedId: reservedId
        }));

        toast.success(`${gifticon.sale_price.toLocaleString()}원 기프티콘 선택`);

        // 비슷한 가격대 기프티콘 추가 로드
        await loadSimilarPriceGifticons(gifticon);
      } catch (error: any) {
        console.error("기프티콘 선택 오류:", error);
        toast.error(error.message || "기프티콘 선택 중 오류가 발생했습니다.");
      }
    }

  };


  // 할인쿠폰 할인 금액 계산 (totalCostBeforeCoupon 사용하여 순환 의존성 해결)
  const couponDiscount = useMemo(() => {
    if (!selectedCoupon || totalCostBeforeCoupon === 0) return 0;
    
    // 최소 구매 금액 체크
    if (selectedCoupon.min_purchase_amount && totalCostBeforeCoupon < selectedCoupon.min_purchase_amount) {
      return 0;
    }
    
    // 만료일 체크
    const now = new Date();
    const expiryDate = new Date(selectedCoupon.expiry_date);
    if (expiryDate < now) {
      return 0;
    }
    
    // 할인 금액 계산
    if (selectedCoupon.discount_type === 'percent') {
      return Math.floor(totalCostBeforeCoupon * (selectedCoupon.discount_value / 100));
    } else {
      return selectedCoupon.discount_value;
    }
  }, [selectedCoupon, totalCostBeforeCoupon]);

  // 할인쿠폰 적용 후 총 구매 금액
  const totalCost = Math.max(0, totalCostBeforeCoupon - couponDiscount);

  // 총 기프티콘 금액권 계산 (original_price 합계)
  const totalOriginalPrice = Array.from(selectedGifticons.values())
    .reduce((sum, item) => {
      // 자동선택 모드에서는 autoSelectedGifticons에서 찾기
      const sourceList = isAutoSelectMode ? autoSelectedGifticons : gifticons;
      const gifticon = sourceList.find(g => g.id === item.id);
      if (gifticon) {
        return sum + gifticon.original_price;
      }
      return sum;
    }, 0);

  // 총 할인 금액 계산 (기프티콘 할인 + 할인쿠폰 할인)
  const totalDiscount = Array.from(selectedGifticons.values())
    .reduce((sum, item) => {
      // 자동선택 모드에서는 autoSelectedGifticons에서 찾기
      const sourceList = isAutoSelectMode ? autoSelectedGifticons : gifticons;
      const gifticon = sourceList.find(g => g.id === item.id);
      if (gifticon) {
        const discountPerItem = gifticon.original_price - gifticon.sale_price;
        return sum + discountPerItem;
      }
      return sum;
    }, 0) + couponDiscount;

  const handlePayment = async () => {
    // 선택한 기프티콘이 없으면 바로 Step 2로 이동
    if (selectedGifticons.size === 0) {
      setStep(2);
      return;
    }


    if (!isLoggedIn) {
      toast.error("세션이 필요합니다.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error("세션이 필요합니다.");
      return;
    }

    setIsLoading(true);
    try {
      // 모든 선택한 기프티콘을 판매완료로 변경
      const allReservedIds: string[] = [];
      const purchasedGifticonsData: Array<{ gifticon: UsedGifticon; reservedId: string }> = [];
      
      // 자동선택 모드에서는 autoSelectedGifticons에서 찾기
      const sourceList = isAutoSelectMode ? autoSelectedGifticons : gifticons;
      for (const selected of selectedGifticons.values()) {
        allReservedIds.push(selected.reservedId);
        const gifticon = sourceList.find(g => g.id === selected.id);
        if (gifticon) {
          purchasedGifticonsData.push({ gifticon, reservedId: selected.reservedId });
        }
      }

      // 이미 결제 완료된 기프티콘 제외하고 새로 결제할 항목만 필터링
      const newReservedIds = allReservedIds.filter(id => !completedPurchases.has(id));

      // 새로 결제할 항목이 없으면 Step 2로 이동만
      if (newReservedIds.length === 0) {
        setIsLoading(false);
        setStep(2);
        return;
      }

      // used_gifticons에서 상세 정보 조회 (새로 결제할 항목만)
      const { data: usedGifticonsData, error: fetchError } = await supabase
        .from('used_gifticons')
        .select('*')
        .in('id', newReservedIds);

      if (fetchError) throw fetchError;

      // 타입 안전성을 위한 타입 단언 (name 필드가 추가됨)
      type UsedGifticonWithName = UsedGifticon & { name?: string };
      const typedGifticonsData = usedGifticonsData as UsedGifticonWithName[];

      // 판매완료로 상태 변경 (새로 결제할 항목만)
      console.log("판매완료 변경 시도:", newReservedIds);
      const { error: updateError } = await supabase
        .from('used_gifticons')
        .update({ status: '판매완료' })
        .in('id', newReservedIds);

      if (updateError) {
        console.error("판매완료 변경 오류:", updateError);
        throw updateError;
      }
      console.log("판매완료 변경 성공");

      // gifticons 테이블의 상태도 판매완료로 업데이트 (id로 조인)
      const { error: updateGifticonsError } = await supabase
        .from('gifticons')
        .update({ 
          status: '판매완료',
          is_selling: false 
        })
        .in('id', newReservedIds);

      if (updateGifticonsError) {
        console.error("gifticons 판매완료 변경 오류:", updateGifticonsError);
        // 에러가 발생해도 계속 진행 (used_gifticons는 이미 업데이트됨)
      } else {
        console.log("gifticons 판매완료 변경 성공");
      }

      // gifticons 테이블에 구매한 기프티콘 추가
      if (typedGifticonsData && typedGifticonsData.length > 0) {
        const gifticonsToInsert = typedGifticonsData.map((item) => ({
          user_id: session.user.id,
          brand: item.available_at, // available_at을 brand로 사용
          name: item.name || `${item.available_at} 기프티콘`, // used_gifticons의 name 사용 (없으면 fallback)
          image: '🎫', // 기본 이미지
          original_price: item.original_price,
          expiry_date: item.expiry_date,
          status: '사용가능', // 초기 상태는 사용가능 (step 2 진입 시 사용완료로 변경)
          is_selling: false,
          barcode: item.barcode, // 바코드도 함께 저장
        }));

        const { error: insertError } = await supabase
          .from('gifticons')
          .insert(gifticonsToInsert);

        if (insertError) throw insertError;

        // 방금 구매한 기프티콘 개수 저장 (step 2에서 사용완료 처리 시 사용)
        setRecentlyPurchasedCount(typedGifticonsData.length);
      }

      toast.success("결제가 완료되었습니다!");
      
      // 결제 완료된 기프티콘 ID 저장 (기존 + 새로 결제한 항목)
      setCompletedPurchases(prev => new Set([...prev, ...newReservedIds]));
      
      // 선택 상태는 유지 (뒤로가기 방지용)
      setStep(2);
    } catch (error: any) {
      console.error("결제 오류:", error);
      toast.error(error.message || "결제 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 결제 완료 처리 (상태 초기화 및 메인으로 이동)
  const handlePaymentComplete = () => {
    toast.success('결제가 완료되었습니다!');
    
    // sessionStorage 정리
    sessionStorage.removeItem('toss_payment_order');
    sessionStorage.removeItem('toss_payment_return_url');
    sessionStorage.removeItem('payment_success');
    sessionStorage.removeItem('payment_result');
    
    // 상태 초기화
    setSelectedGifticons(new Map());
    setCompletedPurchases(new Set());
    
    // 메인으로 이동
    navigate('/main');
  };

  const handleConfirmStep1 = async () => {
    // MVP 시연용: Step 1 → Step 3 (가짜 결제 완료 페이지로 바로 이동, 검증 없음)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("세션이 필요합니다.");
        navigate('/');
        return;
      }

      // MVP 시연용: 선택된 모든 기프티콘을 판매중으로 전환
      const selectedIds: string[] = [];
      for (const selected of selectedGifticons.values()) {
        selectedIds.push(selected.reservedId || selected.id);
      }

      if (selectedIds.length > 0) {
        const { error: updateError } = await supabase
          .from('used_gifticons')
          .update({ status: '판매중' })
          .in('id', selectedIds);

        if (updateError) {
          console.error("판매중 변경 오류:", updateError);
          // 에러가 발생해도 계속 진행 (MVP 시연용)
        }
      }

      // customerKey 생성 (사용자 ID 기반)
      const customerKey = `customer_${session.user.id.replace(/-/g, '').substring(0, 20)}`;
      
      // orderId 생성
      const orderId = generateOrderId();
      
      // 주문 정보를 sessionStorage에 저장
      const orderData = {
        orderId,
        amount: totalCost || 0,
        orderName: `${actualStoreName || '매장'} 기프티콘 ${selectedGifticons.size || 0}개`,
        storeId,
        storeName: actualStoreName,
        storeBrand,
        customerKey,
        gifticons: Array.from(selectedGifticons.values()),
        selectedGifticonIds: Array.from(selectedGifticons.keys()),
        timestamp: new Date().toISOString(),
      };
      
      sessionStorage.setItem('toss_payment_order', JSON.stringify(orderData));
      
      // MVP 시연용: Step 3로 바로 이동 (가짜 결제 완료 페이지)
      navigate(`/payment/${storeId}?step=3`, { replace: false });

    } catch (error: any) {
      console.error("오류:", error);
      // 에러가 발생해도 Step 3로 이동 (MVP 시연용)
      navigate(`/payment/${storeId}?step=3`, { replace: false });
    }
  };

  // Step 2에서 결제하기 버튼 클릭 시 네이버페이 앱 실행
  const handlePayWithNaverPay = () => {
    // 안드로이드 전용 - 네이버페이 앱 패키지명
    if (window.location) {
      window.location.href = "intent://launch#Intent;package=com.samsung.android.spay;end;";
    }
  };

  // Step 3에서 뒤로가기 클릭 시 처리
  const handleBackFromStep3 = () => {
    // 결제 완료 후에는 뒤로가기 불가 (메인으로 이동)
    toast.info('결제가 완료되었습니다. 메인 페이지로 이동합니다.');
    navigate('/main');
  };

  // 2단계에서 보여줄 총 카드 수 (기프티콘 + 멤버십)
  const totalCards = selectedGifticons.size + 1;

  const BarcodeDisplay = ({ number }: { number: string }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
      if (svgRef.current && number) {
        try {
          // 숫자만 추출 (문자열이 있을 수 있음)
          const barcodeNumber = number.replace(/\D/g, '');
          
          if (barcodeNumber.length === 0) {
            return;
          }

          // EAN-13 형식인지 확인 (13자리)
          if (barcodeNumber.length === 13) {
            try {
              JsBarcode(svgRef.current, barcodeNumber, {
                format: "EAN13",
                width: 2,
                height: 80,
                displayValue: false,
                background: "transparent",
                lineColor: "#000000",
                margin: 0,
              });
            } catch (ean13Error) {
              // EAN-13 체크섬 오류 시 CODE128로 대체
              console.warn("EAN13 체크섬 오류, CODE128로 변경:", ean13Error);
              JsBarcode(svgRef.current, barcodeNumber, {
                format: "CODE128",
                width: 2,
                height: 80,
                displayValue: false,
                background: "transparent",
                lineColor: "#000000",
                margin: 0,
              });
            }
          } else if (barcodeNumber.length === 8) {
            // EAN-8 형식 (8자리)
            try {
              JsBarcode(svgRef.current, barcodeNumber, {
                format: "EAN8",
                width: 2,
                height: 80,
                displayValue: false,
                background: "transparent",
                lineColor: "#000000",
                margin: 0,
              });
            } catch (ean8Error) {
              // EAN-8 체크섬 오류 시 CODE128로 대체
              console.warn("EAN8 체크섬 오류, CODE128로 변경:", ean8Error);
              JsBarcode(svgRef.current, barcodeNumber, {
                format: "CODE128",
                width: 2,
                height: 80,
                displayValue: false,
                background: "transparent",
                lineColor: "#000000",
                margin: 0,
              });
            }
          } else {
            // CODE128 형식 (다양한 길이 지원)
            JsBarcode(svgRef.current, barcodeNumber, {
              format: "CODE128",
              width: 2,
              height: 80,
              displayValue: false,
              background: "transparent",
              lineColor: "#000000",
              margin: 0,
            });
          }
        } catch (error) {
          console.error("바코드 생성 오류:", error);
        }
      }
    }, [number]);

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-center bg-white p-3 rounded-lg">
          <svg
            ref={svgRef}
            className="max-w-full h-20"
            style={{ maxHeight: '80px' }}
          />
        </div>
        <p className="text-center font-mono text-xs tracking-widest">{number}</p>
      </div>
    );
  };

  // 선택한 기프티콘 목록 생성
  const purchasedGifticonsList: Array<{ id: string; gifticon: UsedGifticon }> = [];
  // 자동선택 모드에서는 autoSelectedGifticons에서 찾기
  const sourceList = isAutoSelectMode ? autoSelectedGifticons : gifticons;
  for (const selected of selectedGifticons.values()) {
    const gifticon = sourceList.find(g => g.id === selected.id);
    if (gifticon) {
      purchasedGifticonsList.push({ id: selected.reservedId || gifticon.id, gifticon });
    }
  }

  // Step 2 진입 시 예약된 기프티콘의 실제 바코드 조회
  useEffect(() => {
    const fetchActualBarcodes = async () => {
      if (step !== 2 || selectedGifticons.size === 0) return;

      // 모든 예약된 기프티콘 ID 수집
      const allReservedIds: string[] = [];
      for (const selected of selectedGifticons.values()) {
        allReservedIds.push(selected.reservedId);
      }

      if (allReservedIds.length === 0) return;

      if (!isLoggedIn) return;

      try {
        // 각 예약된 기프티콘의 실제 바코드 조회
        const { data: gifticonsData, error } = await supabase
          .from('used_gifticons')
          .select('id, barcode')
          .in('id', allReservedIds);

        if (error) throw error;

        if (gifticonsData) {
          const barcodeMap = new Map<string, string>();
          gifticonsData.forEach((item) => {
            barcodeMap.set(item.id, item.barcode);
          });
          setActualGifticonBarcodes(barcodeMap);
        }
      } catch (error: any) {
        console.error("기프티콘 바코드 조회 오류:", error);
      }
    };

    fetchActualBarcodes();
  }, [step, selectedGifticons, isLoggedIn]);

  // Step 2 진입 시 (바코드 표시 시) 자동으로 사용완료 처리
  useEffect(() => {
    const markGifticonsAsUsed = async () => {
      if (step !== 2 || recentlyPurchasedCount === 0) return;
      if (!isLoggedIn) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      try {
        // 가장 최근에 구매한 기프티콘들을 조회 (방금 추가된 것들)
        const { data: recentGifticons, error: fetchError } = await supabase
          .from('gifticons')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('status', '사용가능')
          .order('created_at', { ascending: false })
          .limit(recentlyPurchasedCount);

        if (fetchError) throw fetchError;

        // 방금 구매한 기프티콘들을 사용완료로 변경
        if (recentGifticons && recentGifticons.length > 0) {
          const gifticonIds = recentGifticons.map(g => g.id);
          const { error: updateError } = await supabase
            .from('gifticons')
            .update({ status: '사용완료' })
            .in('id', gifticonIds)
            .eq('user_id', session.user.id)
            .eq('status', '사용가능');

          if (updateError) throw updateError;

          // 처리 완료 후 카운트 초기화
          setRecentlyPurchasedCount(0);
        }
      } catch (error: any) {
        console.error("기프티콘 사용완료 처리 오류:", error);
        // 오류가 발생해도 사용자에게는 표시하지 않음 (이미 바코드는 보여주고 있으므로)
      }
    };

    // step 2 진입 후 약간의 딜레이를 두고 실행 (상태 업데이트 완료 후)
    const timer = setTimeout(() => {
      markGifticonsAsUsed();
    }, 500);

    return () => clearTimeout(timer);
  }, [step, recentlyPurchasedCount, isLoggedIn]);

  // 초기 로딩 중일 때 전체 로딩 화면 표시
  if (isInitialLoading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-background ${step === 3 ? 'h-screen overflow-hidden' : 'min-h-screen pb-6'}`}>
      {/* 튜토리얼 배너 (튜토리얼 모드에서만 표시) */}
      {(step === 1 || step === 2) && (
        <header className="sticky top-0 z-50 bg-card border-b border-border">
          <div className="max-w-md mx-auto py-4 relative">
            {step === 2 ? (
              <button 
                onClick={() => {
                  // Step 2에서 Step 1로 돌아가기
                  console.log('🔙 Step 2 → Step 1 뒤로가기');
                  
                  sessionStorage.removeItem('toss_payment_order');
                  
                  // Step 1로 이동 (cleanup은 useEffect에서 자동 처리)
                  navigate(`/payment/${storeId}`, { replace: false });
                }} 
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10"
              >
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </button>
            ) : (
              <Link to="/main" className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
            )}
            <div className="flex flex-col items-center justify-center">
              <h1 className="text-xl font-bold">
                {step === 2 ? "결제 수단 선택" : (actualStoreName || "매장")}
              </h1>
              {step === 1 && isLoggedIn && storeBrand && (
                <div className="text-xs text-muted-foreground mt-1">
                  {Math.floor(remainingTime / 60)}:{String(remainingTime % 60).padStart(2, '0')}
                </div>
              )}
            </div>
          </div>
        </header>
      )}
      
      <main className={`max-w-md mx-auto ${step === 3 ? 'h-full flex flex-col pl-14 pr-4 overflow-hidden' : 'px-4 py-6 space-y-4'}`}>
        {step === 1 ? (
          <>
            {/* Payment Method Selection */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold mb-4">결제방식 추천</h2>
              {paymentMethods.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground">사용 가능한 결제 방식이 없습니다.</p>
                </div>
              ) : (
                paymentMethods.map((method) => {
                const isSelected = selectedPaymentOptions.has(method.id);
                const isEnabled = method.enabled || false;
                const isGifticon = method.type === 'gifticon';
                const isMembership = method.type === 'membership';
                const isCombined = method.type === 'combined';
                const isRecommended = method.id === recommendedMethodId;
                
                // 할인율/적립률 표시 계산 (description 우선 사용)
                let displayDiscount = method.description || "";
                if (!displayDiscount) {
                  if (isGifticon) {
                    displayDiscount = method.gifticonDiscount ? `${method.gifticonDiscount}% 할인` : gifticonMethodDiscount;
                  } else if (isMembership && method.method_type) {
                    if (method.method_type === '적립' && method.rate) {
                      displayDiscount = `${method.rate}% 적립`;
                    } else if (method.method_type === '스탬프') {
                      displayDiscount = "스탬프 적립";
                    } else if (method.method_type === '결제' && method.rate) {
                      displayDiscount = `${method.rate}% 할인`;
                    } else {
                      displayDiscount = "적용";
                    }
                  } else if (isCombined) {
                    displayDiscount = method.description || "적용";
                  } else {
                    displayDiscount = "적용";
                  }
                }
                
                return (
                  <Card
                    key={method.id}
                    className={`p-4 transition-all border-2 ${
                      !isEnabled
                        ? "bg-muted/30 border-muted opacity-60 cursor-not-allowed"
                        : isSelected
                        ? "border-primary bg-primary/5 cursor-pointer"
                        : "border-border/50 hover:border-border cursor-pointer"
                    }`}
                    onClick={() => {
                      if (isEnabled) {
                        setHasUserSelectedPaymentMethodManually(true);
                        const newSet = new Set(selectedPaymentOptions);
                        if (isSelected) {
                          newSet.delete(method.id);
                        } else {
                          newSet.add(method.id);
                        }
                        setSelectedPaymentOptions(newSet);
                      }
                    }}
                  >
                    <div className="relative">
                      {!isEnabled && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <div className="bg-muted/90 px-4 py-2 rounded-lg border-2 border-muted-foreground/50">
                            <span className="text-sm font-semibold text-muted-foreground">
                              추후 서비스 예정
                            </span>
                          </div>
                        </div>
                      )}
                      <div className={`flex items-start justify-between ${!isEnabled ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-3 flex-1">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (!isEnabled) return;
                              setHasUserSelectedPaymentMethodManually(true);
                              const newSet = new Set(selectedPaymentOptions);
                              if (checked) {
                                newSet.add(method.id);
                              } else {
                                newSet.delete(method.id);
                              }
                              setSelectedPaymentOptions(newSet);
                            }}
                            disabled={!isEnabled}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className={`font-semibold text-sm ${!isEnabled ? 'text-muted-foreground' : ''}`}>
                                {method.name}
                              </h3>
                              {isRecommended && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] px-1.5 py-0 h-4">
                                  추천
                                </Badge>
                              )}
                            </div>
                            {displayDiscount && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {displayDiscount}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
                })
              )}
            </div>

            {/* Gifticon Section */}
            {canUseGifticon && (
              <>
                {/* 가격 입력창 */}
                <div className="space-y-2 mb-4">
                  <label className="text-sm font-medium">결제할 금액 입력 (선택사항)</label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 relative">
                      <Input
                        type="text"
                        placeholder="금액을 입력하세요 (원)"
                        value={inputBudget !== null ? formatNumberWithCommas(inputBudget) : ""}
                        onChange={(e) => {
                          const value = e.target.value.replace(/,/g, "");
                          if (value === "") {
                            setInputBudget(null);
                          } else {
                            const numValue = parseInt(value, 10);
                            if (!isNaN(numValue) && numValue > 0) {
                              if (numValue > 999999) {
                                toast.error("100만원 이하로만 입력 가능합니다.");
                                return;
                              }
                              setInputBudget(numValue);
                            }
                          }
                        }}
                        className="w-full pr-24"
                        min="0"
                        max="999999"
                      />
                      {inputBudget !== null && inputBudget > 0 && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none whitespace-nowrap">
                          {formatToKoreanCurrency(inputBudget)}
                        </span>
                      )}
                    </div>
                    {!isAutoSelectMode ? (
                      <Button
                        onClick={executeAutoSelect}
                        disabled={!inputBudget || inputBudget <= 0 || isLoading}
                        className="shrink-0"
                      >
                        확인
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={() => {
                            if (!inputBudget || inputBudget <= 0) {
                              toast.error("금액을 입력해주세요.");
                              return;
                            }
                            executeAutoSelect();
                          }}
                          disabled={!inputBudget || inputBudget <= 0 || isLoading}
                          className="shrink-0"
                        >
                          수정
                        </Button>
                        <Button
                          onClick={cancelAutoSelect}
                          variant="outline"
                          className="shrink-0"
                        >
                          취소
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <Card className="p-5 rounded-2xl border-border/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Gift className="w-5 h-5 text-primary" />
                      </div>
                      <h2 className={isAutoSelectMode ? "text-base font-bold" : "text-lg font-bold"}>
                        {isAutoSelectMode ? "기프티콘 자동선택" : "추천 기프티콘"}
                      </h2>
                    </div>
                  </div>
                
                {(isAutoSelectMode ? autoSelectedGifticons : gifticons).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        등록된 기프티콘이 없습니다.
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {(isAutoSelectMode ? autoSelectedGifticons : gifticons).map((gifticon, index) => {
                          const isSelected = selectedGifticons.has(gifticon.id);
                          const discountAmount = gifticon.original_price - gifticon.sale_price;
                          const discountPercent = Math.round((discountAmount / gifticon.original_price) * 100);
                          
                          const isDisabled = isLoading || (isAutoSelectMode && !isSelected);

                          return (
                            <div
                              key={gifticon.id}
                              className={`p-4 rounded-xl transition-all ${
                                isDisabled && !isSelected
                                  ? "bg-muted/30 border border-transparent opacity-60 cursor-not-allowed"
                                  : isSelected
                                  ? "bg-primary/10 border-2 border-primary cursor-pointer"
                                  : "bg-muted/50 border border-transparent hover:border-border cursor-pointer"
                              }`}
                              onClick={() => {
                                if (!isDisabled) {
                                  handleToggle(gifticon);
                                }
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-semibold">{gifticon.name || "기프티콘"}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm text-muted-foreground line-through">
                                      {gifticon.original_price.toLocaleString()}원
                                    </span>
                                    <span className="text-sm font-bold text-primary">
                                      {discountPercent}% ({discountAmount.toLocaleString()}원) 할인
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    판매가: {gifticon.sale_price.toLocaleString()}원
                                  </p>
                                </div>
                                <div className="flex items-center">
                                  <Checkbox
                                    checked={isSelected}
                                    disabled={isDisabled}
                                    className="w-5 h-5"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        </div>
                      </>
                    )}

                {selectedGifticons.size > 0 && (
                  <div className="mt-4 pt-4 border-t border-border space-y-4">
                    {/* 할인쿠폰 선택 섹션 */}
                    {availableCoupons.length > 0 && (
                      <Collapsible open={isCouponExpanded} onOpenChange={setIsCouponExpanded}>
                        <div className="space-y-2">
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Ticket className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium">할인쿠폰</span>
                                {selectedCoupon && couponDiscount > 0 && !isCouponExpanded && (
                                  <span className="text-xs text-primary font-medium">
                                    ({selectedCoupon.name} 자동 적용)
                                  </span>
                                )}
                              </div>
                              {isCouponExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </CollapsibleTrigger>
                          
                          {/* 접혀있을 때: 자동 적용된 쿠폰 정보만 표시 */}
                          {!isCouponExpanded && selectedCoupon && couponDiscount > 0 && (
                            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-sm text-primary">{selectedCoupon.name}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {selectedCoupon.description}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-primary text-sm">
                                    -{couponDiscount.toLocaleString()}원
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 펼쳐졌을 때: 쿠폰 선택 UI */}
                          <CollapsibleContent>
                            <div className="space-y-2 pt-2">
                              {availableCoupons.map((coupon) => {
                                const isSelected = selectedCoupon?.id === coupon.id;
                                const canUse = !coupon.min_purchase_amount || totalCostBeforeCoupon >= coupon.min_purchase_amount;
                                const discountAmount = coupon.discount_type === 'percent'
                                  ? Math.floor(totalCostBeforeCoupon * (coupon.discount_value / 100))
                                  : coupon.discount_value;
                                
                                return (
                                  <div
                                    key={coupon.id}
                                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                                      isSelected
                                        ? 'border-primary bg-primary/5'
                                        : canUse
                                        ? 'border-border/50 hover:border-border'
                                        : 'border-muted/50 opacity-50 cursor-not-allowed'
                                    }`}
                                    onClick={() => {
                                      if (canUse) {
                                        setSelectedCoupon(isSelected ? null : coupon);
                                      }
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <Checkbox
                                            checked={isSelected}
                                            disabled={!canUse}
                                            className="w-4 h-4"
                                          />
                                          <div>
                                            <p className="font-semibold text-sm">{coupon.name}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                              {coupon.description}
                                            </p>
                                            {coupon.min_purchase_amount && (
                                              <p className="text-xs text-muted-foreground mt-0.5">
                                                최소 {coupon.min_purchase_amount.toLocaleString()}원 이상 구매
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      {canUse && (
                                        <div className="text-right">
                                          <p className="font-bold text-primary text-sm">
                                            {coupon.discount_type === 'percent' 
                                              ? `${coupon.discount_value}%`
                                              : `${coupon.discount_value.toLocaleString()}원`}
                                          </p>
                                          {totalCostBeforeCoupon > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                              {discountAmount.toLocaleString()}원 할인
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {selectedCoupon && couponDiscount > 0 && (
                              <div className="p-2 bg-primary/10 rounded-lg mt-2">
                                <p className="text-sm font-medium text-primary">
                                  {selectedCoupon.name} 적용: {couponDiscount.toLocaleString()}원 할인
                                </p>
                              </div>
                            )}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    )}

                    {/* 총 금액 표시 */}
                    <div className="space-y-2" ref={totalSummaryRef}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">총 구매 금액</span>
                        <span className="font-bold text-lg text-primary">
                          {totalCost.toLocaleString()}원
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-muted-foreground">총 기프티콘 금액권</span>
                        <span className="font-semibold">
                          {totalOriginalPrice.toLocaleString()}원
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-muted-foreground">총 할인 금액</span>
                        <span className="font-semibold text-primary">
                          {totalDiscount.toLocaleString()}원
                        </span>
                      </div>
                      {couponDiscount > 0 && (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">할인쿠폰 할인</span>
                          <span className="text-xs text-primary">
                            -{couponDiscount.toLocaleString()}원
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
              </>
            )}

            {/* Confirm Button */}
            <Button
              onClick={handleConfirmStep1}
              className="w-full h-14 text-lg font-semibold rounded-xl"
              disabled={isLoading}
            >
              확인
            </Button>
            
          </>
        ) : step === 2 ? (
          <>
            {/* Step 2: 결제 수단 선택 (Toss Payments 결제위젯) */}
            <div className="space-y-4">
              <Card className="p-6">
                <h2 className="text-lg font-bold mb-4">주문 정보</h2>
                <div className="space-y-3">
                  {/* 선택된 기프티콘 목록 */}
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">상품명</span>
                    <div className="space-y-1.5">
                      {Array.from(selectedGifticons.values()).map((selected, index) => {
                        const gifticon = (isAutoSelectMode ? autoSelectedGifticons : gifticons).find(g => g.id === selected.id);
                        if (!gifticon) return null;
                        
                        return (
                          <div key={selected.id} className="flex justify-between items-center bg-muted/30 rounded-lg px-3 py-2">
                            <span className="font-medium text-sm">
                              {index + 1}. {gifticon.name || "기프티콘"}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {gifticon.sale_price.toLocaleString()}원
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* 총 결제 금액 */}
                  <div className="flex justify-between pt-3 border-t">
                    <span className="text-muted-foreground">총 결제 금액</span>
                    <span className="font-bold text-lg text-primary">{totalCost.toLocaleString()}원</span>
                  </div>
                </div>
              </Card>

              {/* 결제위젯 UI 렌더링 영역 */}
              {!isWidgetRendered && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <div className="text-center space-y-2">
                    <p className="text-sm font-medium text-foreground">결제 화면을 불러오는 중입니다</p>
                    <p className="text-xs text-muted-foreground">
                      네트워크 상태에 따라 최대 10초 정도 소요될 수 있습니다
                    </p>
                  </div>
                </div>
              )}
              
              <div id="payment-method" className={isWidgetRendered ? '' : 'hidden'}></div>
              <div id="agreement" className={isWidgetRendered ? '' : 'hidden'}></div>

              {/* 결제하기 버튼 */}
              <Button
                id="payment-button"
                onClick={async () => {
                  if (!paymentWidgets) {
                    toast.error('결제 준비 중입니다. 잠시 후 다시 시도해주세요.');
                    return;
                  }

                  try {
                    setIsLoading(true);
                    const orderDataStr = sessionStorage.getItem('toss_payment_order');
                    if (!orderDataStr) {
                      toast.error('주문 정보를 찾을 수 없습니다.');
                      setStep(1);
                      return;
                    }

                    const orderData = JSON.parse(orderDataStr);
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) {
                      toast.error('세션이 필요합니다.');
                      navigate('/');
                      return;
                    }

                    // 결제 요청
                    await paymentWidgets.requestPayment({
                      orderId: orderData.orderId,
                      orderName: orderData.orderName,
                      successUrl: `${window.location.origin}/payment-success?storeId=${storeId}`,
                      failUrl: `${window.location.origin}/payment-fail`,
                      customerEmail: session.user.email || undefined,
                      customerName: session.user.user_metadata?.name || undefined,
                      customerMobilePhone: session.user.user_metadata?.phone || undefined,
                    });
                  } catch (error: any) {
                    console.error('결제 오류:', error);
                    toast.error(error.message || '결제 중 오류가 발생했습니다.');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                className="w-full h-14 text-lg font-semibold rounded-xl"
                disabled={isLoading || !paymentWidgets}
              >
                {isLoading ? '처리 중...' : paymentWidgets ? '결제하기' : '준비 중...'}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Step 3: Vertical Scroll View (바코드) */}
            <div className="absolute left-2 top-4 flex flex-col gap-3 z-50">
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full"
                onClick={handleBackFromStep3}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
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

            <div className="flex flex-col h-full py-4 overflow-hidden">
              <div 
                className="flex-1 overflow-y-auto snap-y snap-mandatory scrollbar-hide pb-32"
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
                {purchasedGifticonsList.map((item, index) => {
                  const gifticon = item.gifticon;
                  // 실제 바코드가 있으면 사용, 없으면 기본 바코드 사용
                  let actualBarcode = actualGifticonBarcodes.get(item.id);
                  if (!actualBarcode) {
                    actualBarcode = gifticon.barcode;
                  }
                  return (
                    <div
                      key={`gifticon-${item.id}-${index}`}
                      className="snap-start mb-4"
                      style={{
                        scrollSnapAlign: 'start',
                        scrollSnapStop: 'always',
                      }}
                    >
                      <Card className="p-4 rounded-2xl border-border/50">
                        <div className="space-y-3">
                          <BarcodeDisplay number={actualBarcode} />
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Gift className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">기프티콘</p>
                              <p className="font-bold text-sm">{gifticon.name || "기프티콘"}</p>
                              <p className="text-xs text-muted-foreground">
                                {gifticon.sale_price.toLocaleString()}원
                              </p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  );
                })}

                <div 
                  ref={membershipCardRef}
                  className="snap-start"
                  style={{
                    scrollSnapAlign: 'start',
                    scrollSnapStop: 'always',
                  }}
                >
                  <Card className="p-4 rounded-2xl border-border/50 relative overflow-hidden">
                    {/* 딥링크 버튼 - 상단 가로 전체 차지 (Primary 강조) */}
                    <div className="absolute top-0 left-0 right-0 z-20">
                      <Button 
                        ref={membershipAppRef}
                        variant="default" 
                        className="w-full h-10 rounded-t-2xl rounded-b-none bg-primary text-primary-foreground flex items-center justify-start gap-2 px-4 text-[11px] font-bold hover:bg-primary/90 transition-colors shadow-sm"
                        onClick={handleMembershipAppCallout}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {membershipName} 앱 실행
                      </Button>
                    </div>

                    {/* 추후 서비스 예정 오버레이 */}
                    <div 
                      ref={membershipBarcodeRef}
                      className="absolute inset-x-0 bottom-0 top-10 flex flex-col items-center justify-center z-10 bg-background/80 rounded-b-2xl"
                    >
                      {membershipBarcodeImage ? (
                        <div className="w-full flex-1 flex items-center justify-center p-4">
                          <img 
                            src={membershipBarcodeImage} 
                            alt="Uploaded Membership Barcode" 
                            className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                          />
                          <button 
                            className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors"
                            onClick={triggerMembershipUpload}
                          >
                            <Plus className="w-4 h-4 text-primary" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button 
                            className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 hover:bg-primary/20 transition-all border-2 border-primary/20 border-dashed"
                            onClick={triggerMembershipUpload}
                          >
                            <Plus className="w-7 h-7 text-primary" />
                          </button>
                          <div className="bg-muted/90 px-4 py-2 rounded-lg border-2 border-muted-foreground/50">
                            <span className="text-sm font-semibold text-muted-foreground">
                              추후 서비스 예정
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-2 text-center px-6">
                            중앙의 + 버튼을 눌러 바코드 이미지를 등록할 수 있습니다
                          </p>
                        </>
                      )}
                    </div>
                    {isMembershipModalOpen && (
                      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-background/90 pt-10 px-4 space-y-3 text-center">
                        <p className="text-sm font-semibold text-muted-foreground">
                          바코드 캡처하시고 stan에서 바로 적립받으세요
                        </p>
                        <button
                          className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-0 hover:bg-primary/20 transition-all border-2 border-primary/20 border-dashed"
                          onClick={handleConfirmMembershipLaunch}
                        >
                          <span className="text-xs font-bold text-primary">예</span>
                        </button>
                        <button
                          className="text-xs text-muted-foreground underline"
                          onClick={handleCloseMembershipModal}
                        >
                          아니오
                        </button>
                      </div>
                    )}
                    
                    <div className="space-y-3 opacity-50 pt-10">
                      <BarcodeDisplay number="1234567890123" />
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                            <CreditCard className="w-4 h-4 text-secondary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">멤버십</p>
                            <p className="font-bold text-sm">{membershipName}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                  
                  {/* Hidden File Input */}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                  />
                </div>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 right-4 space-y-3">
              <div className="relative">
                {/* 추후 서비스 예정 오버레이 - 왼쪽에 배치 */}
                <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
                  <div className="bg-muted/90 px-2 py-1 rounded-md border border-muted-foreground/50">
                    <span className="text-xs font-semibold text-muted-foreground">
                      추후 서비스 예정
                    </span>
                  </div>
                </div>
                <Button
                  ref={payAppButtonRef}
                  onClick={handlePayWithNaverPay}
                  className="w-full h-14 text-lg font-semibold rounded-xl opacity-50"
                  disabled={true}
                >
                  {isLoading ? "처리 중..." : "결제앱 실행"}
                </Button>
              </div>
              <Button
                ref={paymentCompleteButtonRef}
                onClick={handlePaymentComplete}
                className="w-full h-14 text-lg font-semibold rounded-xl"
              >
                결제 완료
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Payment;
