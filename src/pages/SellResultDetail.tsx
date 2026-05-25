import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Minus, Plus, Loader2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { RecognitionResult } from "@/lib/gifticonRecognition";
import { useRecognitionJob, useRegisterGifticonFromJob } from "@/hooks/use-recognition-jobs";
import { useAuth } from "@/contexts/AuthContext";
import { AutoFitMarquee } from "@/components/AutoFitMarquee";

const SellResultDetail = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [isRegistering, setIsRegistering] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [editableResult, setEditableResult] = useState<RecognitionResult | null>(null);
  const [priceInitialized, setPriceInitialized] = useState(false);

  const { data: job, isLoading } = useRecognitionJob(jobId);
  const registerGifticon = useRegisterGifticonFromJob();

  useEffect(() => {
    if (!jobId) {
      toast.error("인식 작업 ID가 없습니다.");
      navigate("/sell");
      return;
    }
    const baseJobId = jobId.replace("-partial", "");
    setImageData(localStorage.getItem(`gifticon_image_${baseJobId}`));
  }, [jobId, navigate]);

  useEffect(() => {
    if (!job || priceInitialized) return;

    if (job.status !== "completed" || !job.recognition_result) {
      toast.error("인식이 완료되지 않았습니다.");
      navigate("/sell");
      return;
    }

    const result = job.recognition_result as RecognitionResult;

    let finalResult = result;
    if (jobId) {
      const savedResult = localStorage.getItem(`recognition_result_${jobId}`);
      if (savedResult) {
        try { finalResult = JSON.parse(savedResult); } catch {}
      }
    }
    setEditableResult(finalResult);

    let initialPrice = Math.floor(finalResult.originalPrice * 0.9);
    if (jobId) {
      const savedPrice = localStorage.getItem(`gifticon_price_${jobId}`);
      if (savedPrice) initialPrice = parseInt(savedPrice, 10);
    }
    setCurrentPrice(initialPrice);
    setPriceInitialized(true);
  }, [job, jobId, navigate, priceInitialized]);

  const adjustPrice = (percentage: number) => {
    if (!editableResult) return;
    const adjustment = Math.floor(editableResult.originalPrice * (percentage / 100));
    const newPrice = Math.max(0, Math.min(currentPrice + adjustment, editableResult.originalPrice));
    setCurrentPrice(newPrice);
  };

  const handleRegister = async () => {
    if (!job?.recognition_result || !user) return;

    const result = editableResult || (job.recognition_result as RecognitionResult);

    if (currentPrice <= 0) {
      toast.error("판매 가격은 0원보다 커야 합니다.");
      return;
    }
    if (currentPrice > result.originalPrice) {
      toast.error("판매 가격은 원가보다 높을 수 없습니다.");
      return;
    }

    try {
      setIsRegistering(true);

      const baseJobId = job.id.replace("-partial", "");
      await registerGifticon.mutateAsync({
        jobId: baseJobId,
        data: {
          brand: result.brand,
          name: result.productName,
          originalPrice: result.originalPrice,
          expiryDate: result.expiryDate || new Date().toISOString().split("T")[0],
          barcode: result.barcode || "",
          isSelling: true,
          salePrice: currentPrice,
        },
      });

      if (jobId) {
        const baseId = jobId.replace("-partial", "");
        localStorage.removeItem(`gifticon_image_${baseId}`);
        localStorage.removeItem(`gifticon_price_${jobId}`);
        localStorage.removeItem(`recognition_result_${jobId}`);
        localStorage.removeItem("pending_recognition_job_id");
      }

      toast.success("기프티콘이 등록되었습니다!");
      navigate("/my-gifticons");
    } catch (error: any) {
      console.error("등록 오류:", error);
      toast.error(error.message || "기프티콘 등록 중 오류가 발생했습니다.");
    } finally {
      setIsRegistering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!job || !job.recognition_result) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-md mx-auto px-4 py-6 text-center">
          <p className="text-muted-foreground">인식 결과를 불러올 수 없습니다.</p>
          <Button onClick={() => navigate("/sell")} className="mt-4">돌아가기</Button>
        </div>
      </div>
    );
  }

  const result = editableResult || (job.recognition_result as RecognitionResult);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/sell/result/${jobId}`)} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <AutoFitMarquee
            as="h1"
            text={result.productName}
            className="flex-1"
            textClassName="font-bold"
            fontSizeClasses={["text-xl", "text-lg", "text-base", "text-sm"]}
          />
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {imageData && (
          <Card className="p-4">
            <img src={imageData} alt="기프티콘" className="w-full rounded-lg" />
          </Card>
        )}

        <Card className="p-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">브랜드</p>
            <input
              type="text"
              value={result.brand}
              onChange={(e) => {
                const updatedResult = { ...result, brand: e.target.value };
                setEditableResult(updatedResult);
                if (jobId) localStorage.setItem(`recognition_result_${jobId}`, JSON.stringify(updatedResult));
              }}
              className="text-lg font-semibold bg-transparent border-b border-border focus:border-primary focus:outline-none w-full"
            />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">상품명</p>
            <input
              type="text"
              value={result.productName}
              onChange={(e) => {
                const updatedResult = { ...result, productName: e.target.value };
                setEditableResult(updatedResult);
                if (jobId) localStorage.setItem(`recognition_result_${jobId}`, JSON.stringify(updatedResult));
              }}
              className="text-lg font-semibold bg-transparent border-b border-border focus:border-primary focus:outline-none w-full"
            />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">원가</p>
            <input
              type="number"
              value={result.originalPrice}
              onChange={(e) => {
                const price = parseInt(e.target.value) || 0;
                const updatedResult = { ...result, originalPrice: price };
                setEditableResult(updatedResult);
                if (jobId) localStorage.setItem(`recognition_result_${jobId}`, JSON.stringify(updatedResult));
                setCurrentPrice(Math.floor(price * 0.9));
              }}
              className="text-lg font-semibold bg-transparent border-b border-border focus:border-primary focus:outline-none w-full"
            />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">유효기한</p>
            <input
              type="date"
              value={result.expiryDate || ""}
              onChange={(e) => {
                const updatedResult = { ...result, expiryDate: e.target.value };
                setEditableResult(updatedResult);
                if (jobId) localStorage.setItem(`recognition_result_${jobId}`, JSON.stringify(updatedResult));
              }}
              className="text-lg font-semibold bg-transparent border-b border-border focus:border-primary focus:outline-none w-full"
            />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">판매 가격</p>
            <p className="text-2xl font-bold text-primary mb-4">{currentPrice.toLocaleString()}원</p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {([-5, -1, 1, 5] as const).map((pct) => (
              <Button key={pct} variant="outline" onClick={() => adjustPrice(pct)} className="h-12" disabled={isRegistering}>
                {pct < 0 ? <Minus className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {pct > 0 ? "+" : ""}{pct}%
              </Button>
            ))}
          </div>

          <div className="pt-2">
            <p className="text-xs text-muted-foreground text-center">
              원가 대비 {result.originalPrice > 0 ? Math.round((currentPrice / result.originalPrice) * 100) : 0}%
            </p>
          </div>
        </Card>

        <Button onClick={handleRegister} disabled={isRegistering} className="w-full h-14 text-lg font-semibold rounded-xl">
          {isRegistering ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" />등록 중...</>
          ) : (
            "등록하기"
          )}
        </Button>
      </main>

      <BottomNav />
    </div>
  );
};

export default SellResultDetail;
