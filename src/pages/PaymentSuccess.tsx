// 결제 성공 페이지 - 결제 승인 후 바코드 페이지로 리다이렉트
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const confirmPaymentAndRedirect = async () => {
      const paymentKey = searchParams.get('paymentKey');
      const orderId = searchParams.get('orderId');
      const amount = searchParams.get('amount');
      const storeId = searchParams.get('storeId');

      if (!paymentKey || !orderId || !amount) {
        setError('결제 정보가 누락되었습니다.');
        setTimeout(() => navigate('/main'), 2000);
        return;
      }

      try {
        // 결제 승인 API 호출 (Supabase Edge Function 사용)
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setError('세션이 필요합니다.');
          setTimeout(() => navigate('/'), 2000);
          return;
        }

        // Edge Function 호출하여 결제 승인
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: parseInt(amount),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || '결제 승인에 실패했습니다.');
        }

        const result = await response.json();
        console.log('✅ 결제 승인 성공:', result);

        // sessionStorage에서 주문 정보 가져오기
        const orderDataStr = sessionStorage.getItem('toss_payment_order');
        const orderData = orderDataStr ? JSON.parse(orderDataStr) : null;

        // 결제 성공 플래그 설정
        sessionStorage.setItem('payment_success', 'true');
        sessionStorage.setItem('payment_result', JSON.stringify(result));

        // 바코드 페이지로 리다이렉트 (step 3)
        if (storeId) {
          navigate(`/payment/${storeId}?step=3`);
        } else if (orderData?.storeId) {
          navigate(`/payment/${orderData.storeId}?step=3`);
        } else {
          // storeId를 찾을 수 없으면 메인으로
          navigate('/main');
        }

      } catch (err: any) {
        console.error('결제 승인 오류:', err);
        setError(err.message || '결제 승인 중 오류가 발생했습니다.');
        setTimeout(() => navigate('/main'), 3000);
      }
    };

    confirmPaymentAndRedirect();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        {!error ? (
          <>
            <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-primary" />
            <h1 className="text-2xl font-bold mb-2">결제 승인 중</h1>
            <p className="text-muted-foreground">잠시만 기다려주세요...</p>
            <p className="text-sm text-muted-foreground mt-2">바코드 페이지로 이동합니다</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <span className="text-3xl">❌</span>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-destructive">결제 실패</h1>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">메인 페이지로 이동합니다...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;

