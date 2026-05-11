// 결제 실패 페이지
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

const PaymentFail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const code = searchParams.get('code');
  const message = searchParams.get('message');
  const orderId = searchParams.get('orderId');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Card className="p-8">
          <div className="text-center mb-6">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h1 className="text-2xl font-bold mb-2 text-destructive">결제 실패</h1>
            <p className="text-muted-foreground mb-4">
              {message || '결제 처리 중 문제가 발생했습니다.'}
            </p>
          </div>

          {(code || orderId) && (
            <div className="space-y-2 mb-6 bg-muted/50 rounded-lg p-4">
              {code && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">에러 코드</span>
                  <span className="font-medium text-destructive">{code}</span>
                </div>
              )}
              {orderId && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">주문번호</span>
                  <span className="font-medium">{orderId}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={() => navigate('/main')}
              className="w-full"
              variant="outline"
            >
              메인으로 돌아가기
            </Button>
            <Button
              onClick={() => window.history.back()}
              className="w-full"
            >
              다시 시도하기
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PaymentFail;

