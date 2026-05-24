// 결제 성공 페이지 - 결제 승인 후 바코드 페이지로 리다이렉트
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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

      if (!user) {
        setError('세션이 필요합니다.');
        setTimeout(() => navigate('/'), 2000);
        return;
      }

      try {
        // TODO: POST /api/payments/confirm
        const response = await apiClient.post('/payments/confirm', {
          paymentKey,
          orderId,
          amount: parseInt(amount),
        });

        const result = response.data;
        console.log('✅ 결제 승인 성공:', result);

        const orderDataStr = sessionStorage.getItem('toss_payment_order');
        const orderData = orderDataStr ? JSON.parse(orderDataStr) : null;

        sessionStorage.setItem('payment_success', 'true');
        sessionStorage.setItem('payment_result', JSON.stringify(result));

        if (storeId) {
          navigate(`/payment/${storeId}?step=3`);
        } else if (orderData?.storeId) {
          navigate(`/payment/${orderData.storeId}?step=3`);
        } else {
          navigate('/main');
        }
      } catch (err: any) {
        console.error('결제 승인 오류:', err);
        setError(err.response?.data?.message || err.message || '결제 승인 중 오류가 발생했습니다.');
        setTimeout(() => navigate('/main'), 3000);
      }
    };

    confirmPaymentAndRedirect();
  }, [searchParams, navigate, user]);

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
