// Toss Payments SDK 초기화 및 유틸리티
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import { getPaymentMode, validatePaymentKeys, PAYMENT_CONFIG } from './paymentConfig';

const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY;
const secretKey = import.meta.env.VITE_TOSS_SECRET_KEY;

// Toss Payments SDK 인스턴스 캐싱
let tossPaymentsInstance: any = null;
let tossPaymentsLoadingPromise: Promise<any> | null = null;

// Toss Payments 인스턴스 초기화 (캐싱 + 중복 로딩 방지)
export async function initTossPayments(customerKey: string) {
  try {
    validatePaymentKeys();
    
    // 이미 초기화된 인스턴스가 있으면 재사용
    if (tossPaymentsInstance) {
      console.log('✅ Toss Payments 인스턴스 재사용 (캐싱)');
      return tossPaymentsInstance;
    }
    
    // 이미 로딩 중이면 같은 Promise 재사용
    if (tossPaymentsLoadingPromise) {
      console.log('⏳ Toss Payments SDK 로딩 대기 중...');
      return await tossPaymentsLoadingPromise;
    }
    
    console.log('🔵 Toss Payments SDK 로딩 시작');
    const loadStart = performance.now();
    
    tossPaymentsLoadingPromise = loadTossPayments(clientKey);
    
    const tossPayments = await tossPaymentsLoadingPromise;
    tossPaymentsInstance = tossPayments;
    tossPaymentsLoadingPromise = null;
    
    const loadTime = Math.round(performance.now() - loadStart);
    console.log(`✅ Toss Payments SDK 로딩 완료 (${loadTime}ms)`);
    
    return tossPayments;
  } catch (error) {
    console.error('Toss Payments 초기화 실패:', error);
    tossPaymentsLoadingPromise = null;
    throw error;
  }
}

// 결제위젯 초기화
export async function initPaymentWidget(customerKey: string) {
  try {
    const widgetStart = performance.now();
    const tossPayments = await initTossPayments(customerKey);
    
    // 브랜드페이 설정 포함 여부
    const widgetParams: any = { customerKey };
    
    if (PAYMENT_CONFIG.widget.enableBrandpay) {
      widgetParams.brandpay = {
        redirectUrl: `${window.location.origin}/callback-auth`,
      };
    }
    
    const widgets = tossPayments.widgets(widgetParams);
    const widgetTime = Math.round(performance.now() - widgetStart);
    console.log(`✅ 위젯 인스턴스 생성 완료 (${widgetTime}ms)`);
    
    return widgets;
  } catch (error) {
    console.error('결제위젯 초기화 실패:', error);
    throw error;
  }
}

// 브랜드페이 초기화 (나중에 사용)
export async function initBrandPay(customerKey: string) {
  try {
    const tossPayments = await initTossPayments(customerKey);
    const brandpay = tossPayments.brandpay({
      customerKey,
      redirectUrl: `${window.location.origin}/callback-auth`,
    });
    return brandpay;
  } catch (error) {
    console.error('브랜드페이 초기화 실패:', error);
    throw error;
  }
}

// 결제 승인 API 호출 (서버 측)
export async function confirmPayment(paymentKey: string, orderId: string, amount: number) {
  const encodedSecretKey = btoa(`${secretKey}:`);
  
  // 결제 모드에 따라 API 엔드포인트 결정
  const paymentMode = getPaymentMode();
  const apiUrl = paymentMode === 'brandpay' 
    ? 'https://api.tosspayments.com/v1/brandpay/payments/confirm'
    : 'https://api.tosspayments.com/v1/payments/confirm';
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${encodedSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      paymentKey,
      orderId,
      amount,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw error;
  }

  return response.json();
}

// UUID 생성 (주문번호용)
export function generateOrderId(): string {
  return `order_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// customerKey 생성 (사용자 ID 기반)
export function generateCustomerKey(userId: string): string {
  // UUID 형식으로 변환 (이메일이나 전화번호 같은 유추 가능한 값은 사용하지 않음)
  return `customer_${userId.replace(/-/g, '').substring(0, 20)}_${Math.random().toString(36).substring(2, 11)}`;
}

