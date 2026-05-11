// 결제 시스템 설정
// 결제위젯 ↔ 브랜드페이 쉽게 전환 가능

export type PaymentMode = 'widget' | 'brandpay';

export const PAYMENT_CONFIG = {
  // 현재 사용 중인 결제 모드
  // 'widget': 결제위젯 사용 (계약 전에도 테스트 가능, 일반 결제)
  // 'brandpay': 브랜드페이 사용 (계약 필요, 원클릭 간편결제)
  mode: 'widget' as PaymentMode,
  
  // 결제위젯 설정
  widget: {
    // 결제위젯은 브랜드페이 기능도 포함 가능 (계약 후)
    enableBrandpay: false, // true로 변경하면 브랜드페이 활성화
  },
  
  // 브랜드페이 설정 (나중에 사용)
  brandpay: {
    enableOneTouchPay: true, // 원터치결제 사용 여부
  },
};

// 환경 변수에서 자동으로 결제 모드 결정
export function getPaymentMode(): PaymentMode {
  const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY;
  
  // 클라이언트 키 타입으로 자동 감지
  if (clientKey?.startsWith('test_gck_') || clientKey?.startsWith('live_gck_')) {
    return 'widget';
  } else if (clientKey?.startsWith('test_ck_') || clientKey?.startsWith('live_ck_')) {
    return PAYMENT_CONFIG.mode; // 설정에 따라 결정
  }
  
  return 'widget'; // 기본값
}

// 결제 키 검증
export function validatePaymentKeys() {
  const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY;
  const secretKey = import.meta.env.VITE_TOSS_SECRET_KEY;
  
  if (!clientKey || !secretKey) {
    throw new Error('Toss Payments API 키가 설정되지 않았습니다.');
  }
  
  const mode = getPaymentMode();
  
  if (mode === 'widget') {
    if (!clientKey.startsWith('test_gck_') && !clientKey.startsWith('live_gck_')) {
      console.warn('⚠️ 결제위젯 모드인데 결제위젯 연동 키가 아닙니다. API 개별 연동 키를 사용 중입니다.');
    }
  } else if (mode === 'brandpay') {
    if (clientKey.startsWith('test_gck_') || clientKey.startsWith('live_gck_')) {
      throw new Error('브랜드페이 모드는 API 개별 연동 키가 필요합니다.');
    }
  }
  
  return { clientKey, secretKey, mode };
}

