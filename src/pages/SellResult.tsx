import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Minus, Plus, Loader2, ChevronRight, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { useRecognitionJob, useUpdateRecognitionJob } from "@/hooks/use-recognition-jobs";
import { useRegisterGifticonFromJob } from "@/hooks/use-recognition-jobs";
import { useAuth } from "@/contexts/AuthContext";
import { RecognitionResult } from "@/lib/gifticonRecognition";

interface GifticonItem {
  id: string;
  productName: string;
  brand: string;
  originalPrice: number;
  currentPrice: number;
  averagePrice: number | null;
  isSelling: boolean;
  isFailed?: boolean;
  isPartialFailed?: boolean;
}

const SellResult = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [gifticonItems, setGifticonItems] = useState<GifticonItem[]>([]);
  const [imageData, setImageData] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: job, isLoading } = useRecognitionJob(jobId);
  const registerGifticon = useRegisterGifticonFromJob();

  useEffect(() => {
    if (!jobId) {
      toast.error("인식 작업 ID가 없습니다.");
      navigate("/sell");
      return;
    }
    if (jobId) {
      localStorage.setItem("pending_recognition_job_id", jobId);
      const storedImage = localStorage.getItem(`gifticon_image_${jobId}`);
      setImageData(storedImage);
    }
  }, [jobId, navigate]);

  useEffect(() => {
    if (!job) return;

    const recognitionResult = job.recognition_result as RecognitionResult | null;

    if (job.status === "failed" || !recognitionResult) {
      setGifticonItems([{
        id: job.id,
        productName: "인식 실패",
        brand: "",
        originalPrice: 0,
        currentPrice: 0,
        averagePrice: null,
        isSelling: false,
        isFailed: true,
      }]);
      return;
    }

    if (job.status !== "completed") {
      toast.error("인식이 완료되지 않았습니다.");
      navigate("/sell");
      return;
    }

    const result = recognitionResult;
    const initialPrice = Math.floor(result.originalPrice * 0.9);

    setGifticonItems([
      {
        id: `${job.id}-failed`,
        productName: "인식 실패",
        brand: "",
        originalPrice: 0,
        currentPrice: 0,
        averagePrice: null,
        isSelling: false,
        isFailed: true,
        isPartialFailed: false,
      },
      {
        id: `${job.id}-partial`,
        productName: result.productName,
        brand: result.brand,
        originalPrice: result.originalPrice,
        currentPrice: initialPrice,
        averagePrice: null,
        isSelling: false,
        isFailed: false,
        isPartialFailed: true,
      },
      {
        id: job.id,
        productName: result.productName,
        brand: result.brand,
        originalPrice: result.originalPrice,
        currentPrice: initialPrice,
        averagePrice: null,
        isSelling: false,
        isFailed: false,
        isPartialFailed: false,
      },
    ]);
  }, [job, navigate]);

  const adjustPrice = (itemId: string, percentage: number) => {
    setGifticonItems((items) =>
      items.map((item) => {
        if (item.id !== itemId) return item;
        const adjustment = Math.floor(item.originalPrice * (percentage / 100));
        const newPrice = Math.max(0, Math.min(item.currentPrice + adjustment, item.originalPrice));
        if (jobId) localStorage.setItem(`gifticon_price_${jobId}`, newPrice.toString());
        return { ...item, currentPrice: newPrice };
      })
    );
  };

  const handleConfirm = async () => {
    if (!job?.recognition_result || !user) return;
    try {
      setIsProcessing(true);
      const result = job.recognition_result as RecognitionResult;

      for (const item of gifticonItems) {
        await registerGifticon.mutateAsync({
          jobId: job.id,
          data: {
            brand: result.brand,
            name: item.productName,
            originalPrice: item.originalPrice,
            expiryDate: result.expiryDate || new Date().toISOString().split("T")[0],
            barcode: result.barcode || "",
            isSelling: item.isSelling,
            salePrice: item.isSelling ? item.currentPrice : undefined,
          },
        });
      }

      if (jobId) {
        localStorage.removeItem(`gifticon_image_${jobId}`);
        localStorage.removeItem(`gifticon_price_${jobId}`);
        localStorage.removeItem("pending_recognition_job_id");
      }

      toast.success("기프티콘이 등록되었습니다!");
      navigate("/main");
    } catch (error: any) {
      console.error("등록 오류:", error);
      toast.error(error.message || "기프티콘 등록 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkSell = async () => {
    if (!job?.recognition_result || !user) return;
    try {
      setIsProcessing(true);
      const result = job.recognition_result as RecognitionResult;

      for (const item of gifticonItems) {
        await registerGifticon.mutateAsync({
          jobId: job.id,
          data: {
            brand: result.brand,
            name: item.productName,
            originalPrice: item.originalPrice,
            expiryDate: result.expiryDate || new Date().toISOString().split("T")[0],
            barcode: result.barcode || "",
            isSelling: true,
            salePrice: item.currentPrice,
          },
        });
      }

      if (jobId) {
        localStorage.removeItem(`gifticon_image_${jobId}`);
        localStorage.removeItem(`gifticon_price_${jobId}`);
        localStorage.removeItem("pending_recognition_job_id");
      }

      toast.success("기프티콘이 일괄 판매 등록되었습니다!");
      navigate("/main");
    } catch (error: any) {
      console.error("일괄 판매 오류:", error);
      toast.error(error.message || "기프티콘 일괄 판매 등록 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveItem = (itemId: string) => {
    setGifticonItems((items) => items.filter((item) => item.id !== itemId));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!job || gifticonItems.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-md mx-auto px-4 py-6 text-center">
          <p className="text-muted-foreground">인식 결과를 불러올 수 없습니다.</p>
          <Button onClick={() => navigate("/sell")} className="mt-4">돌아가기</Button>
        </div>
      </div>
    );
  }

  const failedItems = gifticonItems.filter((item) => item.isFailed);
  const partialFailedItems = gifticonItems.filter((item) => item.isPartialFailed);
  const successItems = gifticonItems.filter((item) => !item.isFailed && !item.isPartialFailed);
  const hasFailedItems = failedItems.length > 0 || partialFailedItems.length > 0;

  const PriceAdjustButtons = ({ itemId }: { itemId: string }) => (
    <div className="flex gap-0.5">
      {([-5, -1, 1, 5] as const).map((pct) => (
        <Button key={pct} variant="outline" size="sm" className="h-8 px-2.5 text-xs flex-1"
          onClick={(e) => { e.stopPropagation(); adjustPrice(itemId, pct); }}>
          {pct > 0 ? <Plus className="w-3 h-3 mr-1 shrink-0" /> : <Minus className="w-3 h-3 mr-1 shrink-0" />}
          <span>{Math.abs(pct)}%</span>
        </Button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/sell")} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">인식 결과</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {failedItems.map((item) => (
          <Card key={item.id} className="p-4 border-2 border-destructive relative">
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => handleRemoveItem(item.id)}>
              <X className="w-4 h-4" />
            </Button>
            <div className="flex items-start gap-3">
              {imageData && (
                <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted">
                  <img src={imageData} alt="기프티콘" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col">
                <h3 className="font-semibold text-sm mb-2 text-destructive">이미지 인식 실패</h3>
                <p className="text-xs text-muted-foreground mb-4">이미지를 다시 업로드해주세요.</p>
                <Button onClick={() => navigate("/sell")} variant="outline" className="w-full">재업로드</Button>
              </div>
            </div>
          </Card>
        ))}

        {partialFailedItems.map((item) => (
          <Card key={item.id} className="p-4 pt-10 border-2 border-yellow-500 relative cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/sell/result/${jobId}/detail`)}>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
              <p className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">일부 인식 실패 직접 입력해주세요</p>
            </div>
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 z-10"
              onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }}>
              <X className="w-4 h-4" />
            </Button>
            <div className="flex items-start gap-3 pr-8">
              {imageData && (
                <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted">
                  <img src={imageData} alt="기프티콘" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="min-w-0 flex-1 break-words text-sm font-semibold">{item.productName}</h3>
                  <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-muted-foreground">판매</span>
                    <Switch checked={item.isSelling} onCheckedChange={(checked) =>
                      setGifticonItems((items) => items.map((i) => i.id === item.id ? { ...i, isSelling: checked } : i))} />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-lg font-bold text-primary">{item.currentPrice.toLocaleString()}원</p>
                  <p className="text-xs text-muted-foreground line-through">{item.originalPrice.toLocaleString()}원</p>
                </div>
                <PriceAdjustButtons itemId={item.id} />
              </div>
            </div>
            <div className="absolute inset-y-0 right-3 z-10 flex items-center pointer-events-none">
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </Card>
        ))}

        {successItems.map((item) => (
          <Card key={item.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow relative"
            onClick={() => navigate(`/sell/result/${jobId}/detail`)}>
            <div className="flex items-start gap-3 pr-8">
              {imageData && (
                <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted">
                  <img src={imageData} alt="기프티콘" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="min-w-0 flex-1 break-words text-sm font-semibold">{item.productName}</h3>
                  <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-muted-foreground">판매</span>
                    <Switch checked={item.isSelling} onCheckedChange={(checked) =>
                      setGifticonItems((items) => items.map((i) => i.id === item.id ? { ...i, isSelling: checked } : i))} />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-lg font-bold text-primary">{item.currentPrice.toLocaleString()}원</p>
                  <p className="text-xs text-muted-foreground line-through">{item.originalPrice.toLocaleString()}원</p>
                </div>
                <PriceAdjustButtons itemId={item.id} />
              </div>
            </div>
            <div className="absolute inset-y-0 right-3 z-10 flex items-center pointer-events-none">
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </Card>
        ))}

        {(successItems.length > 0 || partialFailedItems.length > 0) && (
          <div className="flex flex-col gap-3 pt-4">
            {hasFailedItems && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-2">
                <p className="text-sm text-destructive text-center">인식 실패 항목을 처리한 후 등록할 수 있습니다.</p>
              </div>
            )}
            <Button onClick={handleConfirm} disabled={isProcessing || hasFailedItems} className="w-full h-14 text-lg font-semibold rounded-xl" size="lg">
              {isProcessing ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />처리 중...</> : "확인"}
            </Button>
            <Button onClick={handleBulkSell} disabled={isProcessing || hasFailedItems} variant="outline" className="w-full h-12 text-base font-medium rounded-xl">
              {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />처리 중...</> : "일괄 판매"}
            </Button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default SellResult;
