import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Minus, Plus, Loader2, ChevronRight, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RecognitionResult } from "@/lib/gifticonRecognition";

interface RecognitionJob {
  id: string;
  user_id: string;
  status: string;
  recognition_result: RecognitionResult | null;
  created_at: string;
}

interface GifticonItem {
  id: string;
  productName: string;
  brand: string;
  originalPrice: number;
  currentPrice: number;
  averagePrice: number | null;
  isSelling: boolean;
  isFailed?: boolean; // 전체 인식 실패 여부
  isPartialFailed?: boolean; // 일부 정보 인식 실패 여부
}

const SellResult = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<RecognitionJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [gifticonItems, setGifticonItems] = useState<GifticonItem[]>([]);
  const [imageData, setImageData] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!jobId) {
      toast.error("인식 작업 ID가 없습니다.");
      navigate("/sell");
      return;
    }
    loadRecognitionJob();
  }, [jobId, navigate]);

  const loadRecognitionJob = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("세션이 필요합니다. 페이지를 새로고침해주세요.");
        navigate("/main");
        return;
      }

      // 인식 작업 조회
      const { data, error } = await supabase
        .from("gifticon_recognition_jobs")
        .select("*")
        .eq("id", jobId)
        .eq("user_id", session.user.id)
        .single();

      if (error || !data) {
        throw error || new Error("인식 작업을 찾을 수 없습니다.");
      }

      const recognitionResult = data.recognition_result
        ? (data.recognition_result as unknown as RecognitionResult)
        : null;

      setJob({ ...data, recognition_result: recognitionResult });

      // pending_job_id를 로컬 스토리지에 저장 (미완료 상태 추적용)
      if (jobId) {
        localStorage.setItem('pending_recognition_job_id', jobId);
      }

      // 로컬 스토리지에서 이미지 로드
      if (jobId) {
        const storedImage = localStorage.getItem(`gifticon_image_${jobId}`);
        setImageData(storedImage);
      }

      // 인식 실패 케이스 처리
      if (data.status === "failed" || !recognitionResult) {
        setGifticonItems([{
          id: data.id,
          productName: "인식 실패",
          brand: "",
          originalPrice: 0,
          currentPrice: 0,
          averagePrice: null,
          isSelling: false,
          isFailed: true,
        }]);
        setLoading(false);
        return;
      }

      // 인식 완료 케이스 처리
      if (data.status !== "completed") {
        toast.error("인식이 완료되지 않았습니다.");
        navigate("/sell");
        return;
      }

      const result = recognitionResult;
      
      // 평균 가격 조회
      const avgPrice = await loadAveragePrice(result.productName, result.brand);
      const initialPrice = avgPrice || Math.floor(result.originalPrice * 0.9);

      // 단일 상품을 배열로 변환 (나중에 여러 상품 인식 시 확장 가능)
      // 데모를 위해 항상 실패 항목과 일부 실패 항목 추가
      setGifticonItems([
        {
          id: `${data.id}-failed`,
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
          id: `${data.id}-partial`,
          productName: result.productName,
          brand: result.brand,
          originalPrice: result.originalPrice,
          currentPrice: initialPrice,
          averagePrice: avgPrice,
          isSelling: false,
          isFailed: false,
          isPartialFailed: true, // 일부 정보 인식 실패
        },
        {
          id: data.id,
          productName: result.productName,
          brand: result.brand,
          originalPrice: result.originalPrice,
          currentPrice: initialPrice,
          averagePrice: avgPrice,
          isSelling: false, // 기본값: 판매 안 함
          isFailed: false,
          isPartialFailed: false,
        },
      ]);

    } catch (error: any) {
      console.error("인식 작업 로드 오류:", error);
      toast.error(error.message || "인식 결과를 불러오는 중 오류가 발생했습니다.");
      navigate("/sell");
    } finally {
      setLoading(false);
    }
  };

  const loadAveragePrice = async (productName: string, brand: string): Promise<number | null> => {
    try {
      // 1. gifticon_average_prices 테이블에서 조회
      const { data: avgPriceData, error: avgPriceError } = await supabase
        .from("gifticon_average_prices")
        .select("average_price")
        .eq("product_name", productName)
        .eq("brand", brand)
        .single();

      if (!avgPriceError && avgPriceData) {
        return avgPriceData.average_price;
      }

      // 2. 없으면 used_gifticons에서 최근 거래의 평균 계산
      const { data: usedGifticons, error: usedError } = await supabase
        .from("used_gifticons")
        .select("sale_price")
        .eq("name", productName)
        .eq("status", "판매완료")
        .order("created_at", { ascending: false })
        .limit(30);

      if (!usedError && usedGifticons && usedGifticons.length > 0) {
        const sum = usedGifticons.reduce((acc, item) => acc + item.sale_price, 0);
        const avg = Math.floor(sum / usedGifticons.length);

        // 평균 가격을 테이블에 저장/업데이트
        await supabase
          .from("gifticon_average_prices")
          .upsert({
            product_name: productName,
            brand: brand,
            average_price: avg,
            sample_count: usedGifticons.length,
            last_updated_at: new Date().toISOString(),
          }, {
            onConflict: "product_name,brand"
          });
        return avg;
      }

      return null;
    } catch (error) {
      console.error("평균 가격 조회 오류:", error);
      return null;
    }
  };

  const adjustPrice = (itemId: string, percentage: number) => {
    setGifticonItems(items => items.map(item => {
      if (item.id !== itemId) return item;
      
      const adjustment = Math.floor(item.originalPrice * (percentage / 100));
      const newPrice = item.currentPrice + adjustment;
      const clampedPrice = Math.max(0, Math.min(newPrice, item.originalPrice));
      
      // 로컬 스토리지에 가격 저장 (상세 페이지에서 사용)
      if (jobId) {
        localStorage.setItem(`gifticon_price_${jobId}`, clampedPrice.toString());
      }
      
      return { ...item, currentPrice: clampedPrice };
    }));
  };

  const handleCardClick = (itemId: string) => {
    navigate(`/sell/result/${jobId}/detail`);
  };


  const handleConfirm = async () => {
    if (!job?.recognition_result) return;

    try {
      setIsProcessing(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("세션이 필요합니다.");
        return;
      }

      const result = job.recognition_result;

      // switch가 켜진 것만 판매중, 나머지는 보유중으로 등록
      for (const item of gifticonItems) {
        const isSelling = item.isSelling;

        // gifticons 테이블에 등록
        const { data: gifticonData, error: gifticonError } = await supabase
          .from("gifticons")
          .insert({
            user_id: session.user.id,
            brand: result.brand,
            name: item.productName,
            original_price: item.originalPrice,
            image: '',
            expiry_date: result.expiryDate || new Date().toISOString().split('T')[0],
            status: "사용가능",
            is_selling: isSelling,
            barcode: result.barcode || null,
          })
          .select()
          .single();

        if (gifticonError || !gifticonData) {
          console.error("기프티콘 등록 오류:", gifticonError);
          continue;
        }

        // 판매중인 경우에만 used_gifticons에 등록
        if (isSelling) {
          const { error: usedError } = await supabase
            .from("used_gifticons")
            .insert({
              id: gifticonData.id,
              seller_id: session.user.id,
              available_at: result.brand,
              name: item.productName,
              barcode: result.barcode || '',
              original_price: item.originalPrice,
              sale_price: item.currentPrice,
              expiry_date: result.expiryDate || new Date().toISOString().split('T')[0],
              status: '판매중'
            });

          if (usedError) {
            // 이미 존재하는 경우 업데이트
            if (usedError.code === '23505') {
              await supabase
                .from("used_gifticons")
                .update({
                  sale_price: item.currentPrice,
                  status: '판매중'
                })
                .eq("id", gifticonData.id);
            }
          }

          // 평균 가격 업데이트
          await updateAveragePrice(item.productName, result.brand, item.currentPrice);
        }
      }

      // 로컬 스토리지에서 이미지 및 pending_job_id 삭제
      if (jobId) {
        localStorage.removeItem(`gifticon_image_${jobId}`);
        localStorage.removeItem(`gifticon_price_${jobId}`);
        localStorage.removeItem('pending_recognition_job_id');
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
    if (!job?.recognition_result) return;

    try {
      setIsProcessing(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("세션이 필요합니다.");
        return;
      }

      const result = job.recognition_result as RecognitionResult;

      // 모든 기프티콘을 판매중 상태로 등록 (switch와 상관없이)
      for (const item of gifticonItems) {
        // gifticons 테이블에 등록
        const { data: gifticonData, error: gifticonError } = await supabase
          .from("gifticons")
          .insert({
            user_id: session.user.id,
            brand: result.brand,
            name: item.productName,
            original_price: item.originalPrice,
            image: '',
            expiry_date: result.expiryDate || new Date().toISOString().split('T')[0],
            status: "사용가능",
            is_selling: true, // 판매중
            barcode: result.barcode || null,
          })
          .select()
          .single();

        if (gifticonError || !gifticonData) {
          console.error("기프티콘 등록 오류:", gifticonError);
          continue;
        }

        // used_gifticons에 판매 정보 등록
        const { error: usedError } = await supabase
          .from("used_gifticons")
          .insert({
            id: gifticonData.id,
            seller_id: session.user.id,
            available_at: result.brand,
            name: item.productName,
            barcode: result.barcode || '',
            original_price: item.originalPrice,
            sale_price: item.currentPrice,
            expiry_date: result.expiryDate || new Date().toISOString().split('T')[0],
            status: '판매중'
          });

        if (usedError) {
          // 이미 존재하는 경우 업데이트
          if (usedError.code === '23505') {
            await supabase
              .from("used_gifticons")
              .update({
                sale_price: item.currentPrice,
                status: '판매중'
              })
              .eq("id", gifticonData.id);
          }
        }

        // 평균 가격 업데이트
        await updateAveragePrice(item.productName, result.brand, item.currentPrice);
      }

      // 로컬 스토리지에서 이미지 및 pending_job_id 삭제
      if (jobId) {
        localStorage.removeItem(`gifticon_image_${jobId}`);
        localStorage.removeItem(`gifticon_price_${jobId}`);
        localStorage.removeItem('pending_recognition_job_id');
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

  const updateAveragePrice = async (productName: string, brand: string, newPrice: number) => {
    try {
      const { data: existingData } = await supabase
        .from("gifticon_average_prices")
        .select("average_price, sample_count")
        .eq("product_name", productName)
        .eq("brand", brand)
        .single();

      if (existingData) {
        const totalCount = existingData.sample_count + 1;
        const totalSum = existingData.average_price * existingData.sample_count + newPrice;
        const newAverage = Math.floor(totalSum / totalCount);

        await supabase
          .from("gifticon_average_prices")
          .update({
            average_price: newAverage,
            sample_count: totalCount,
            last_updated_at: new Date().toISOString(),
          })
          .eq("product_name", productName)
          .eq("brand", brand);
      } else {
        await supabase
          .from("gifticon_average_prices")
          .insert({
            product_name: productName,
            brand: brand,
            average_price: newPrice,
            sample_count: 1,
            last_updated_at: new Date().toISOString(),
          });
      }
    } catch (error) {
      console.error("평균 가격 업데이트 오류:", error);
    }
  };

  if (loading) {
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
          <Button onClick={() => navigate("/sell")} className="mt-4">
            돌아가기
          </Button>
        </div>
      </div>
    );
  }

  // 항목 분리: 전체 실패, 일부 실패, 성공
  const failedItems = gifticonItems.filter(item => item.isFailed);
  const partialFailedItems = gifticonItems.filter(item => item.isPartialFailed);
  const successItems = gifticonItems.filter(item => !item.isFailed && !item.isPartialFailed);

  // 버튼 비활성화 조건: 전체 실패 또는 일부 실패 항목이 하나라도 있으면 비활성화
  const hasFailedItems = failedItems.length > 0 || partialFailedItems.length > 0;

  // 항목 삭제 함수
  const handleRemoveItem = (itemId: string) => {
    setGifticonItems(items => items.filter(item => item.id !== itemId));
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/sell")}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">인식 결과</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* 인식 실패 카드 (최상단, 빨간색 테두리) */}
        {failedItems.map((item) => (
          <Card
            key={item.id}
            className="p-4 border-2 border-destructive relative"
          >
            {/* 우측 상단 X 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={() => handleRemoveItem(item.id)}
            >
              <X className="w-4 h-4" />
            </Button>
            <div className="flex items-start gap-3">
              {/* 왼쪽: 작은 이미지 */}
              {imageData && (
                <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted">
                  <img
                    src={imageData}
                    alt="기프티콘"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* 오른쪽: 실패 메시지 및 재업로드 버튼 */}
              <div className="flex-1 min-w-0 flex flex-col">
                <h3 className="font-semibold text-sm mb-2 text-destructive">
                  이미지 인식 실패
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  이미지를 다시 업로드해주세요.
                </p>
                <Button
                  onClick={() => navigate("/sell")}
                  variant="outline"
                  className="w-full"
                >
                  재업로드
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {/* 일부 정보 인식 실패 카드 (노란색 테두리) */}
        {partialFailedItems.map((item) => (
          <Card
            key={item.id}
            className="p-4 pt-10 border-2 border-yellow-500 relative cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleCardClick(item.id)}
          >
            {/* 중앙 상단 안내 텍스트 */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
              <p className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">
                일부 인식 실패 직접 입력해주세요
              </p>
            </div>
            
            {/* 우측 상단 X 버튼 */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6 z-10"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveItem(item.id);
              }}
            >
              <X className="w-4 h-4" />
            </Button>
            <div className="flex items-start gap-3 pr-8">
              {/* 왼쪽: 작은 이미지 */}
              {imageData && (
                <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted">
                  <img
                    src={imageData}
                    alt="기프티콘"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* 오른쪽: 상품 정보 */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-sm truncate flex-1">
                    {item.productName}
                  </h3>
                  {/* 판매 설정 스위치 */}
                  <div
                    className="flex items-center gap-2 shrink-0 ml-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs text-muted-foreground">판매</span>
                    <Switch
                      checked={item.isSelling}
                      onCheckedChange={(checked) => {
                        setGifticonItems(items => items.map(i => 
                          i.id === item.id ? { ...i, isSelling: checked } : i
                        ));
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-lg font-bold text-primary">
                    {item.currentPrice.toLocaleString()}원
                  </p>
                  <p className="text-xs text-muted-foreground line-through">
                    {item.originalPrice.toLocaleString()}원
                  </p>
                </div>
                
                {/* 가격 조정 버튼 */}
                <div className="flex gap-0.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustPrice(item.id, -5);
                    }}
                  >
                    <Minus className="w-3 h-3 mr-1 shrink-0" />
                    <span>5%</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustPrice(item.id, -1);
                    }}
                  >
                    <Minus className="w-3 h-3 mr-1 shrink-0" />
                    <span>1%</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustPrice(item.id, 1);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1 shrink-0" />
                    <span>1%</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustPrice(item.id, 5);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1 shrink-0" />
                    <span>5%</span>
                  </Button>
                </div>
              </div>

            </div>
            <div className="absolute inset-y-0 right-3 z-10 flex items-center pointer-events-none">
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>

          </Card>
        ))}

        {/* 성공한 기프티콘 카드 리스트 */}
        {successItems.map((item) => (
          <Card
            key={item.id}
            className="p-4 cursor-pointer hover:shadow-md transition-shadow relative"
            onClick={() => handleCardClick(item.id)}
          >
            <div className="flex items-start gap-3 pr-8">
              {/* 왼쪽: 작은 이미지 */}
              {imageData && (
                <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted">
                  <img
                    src={imageData}
                    alt="기프티콘"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* 오른쪽: 상품 정보 */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-sm truncate flex-1">
                    {item.productName}
                  </h3>
                  {/* 판매 설정 스위치 */}
                  <div
                    className="flex items-center gap-2 shrink-0 ml-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs text-muted-foreground">판매</span>
                    <Switch
                      checked={item.isSelling}
                      onCheckedChange={(checked) => {
                        setGifticonItems(items => items.map(i => 
                          i.id === item.id ? { ...i, isSelling: checked } : i
                        ));
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-lg font-bold text-primary">
                    {item.currentPrice.toLocaleString()}원
                  </p>
                  <p className="text-xs text-muted-foreground line-through">
                    {item.originalPrice.toLocaleString()}원
                  </p>
                </div>
                
                {/* 가격 조정 버튼 */}
                <div className="flex gap-0.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustPrice(item.id, -5);
                    }}
                  >
                    <Minus className="w-3 h-3 mr-1 shrink-0" />
                    <span>5%</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustPrice(item.id, -1);
                    }}
                  >
                    <Minus className="w-3 h-3 mr-1 shrink-0" />
                    <span>1%</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustPrice(item.id, 1);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1 shrink-0" />
                    <span>1%</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustPrice(item.id, 5);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1 shrink-0" />
                    <span>5%</span>
                  </Button>
                </div>
              </div>
            </div>
            <div className="absolute inset-y-0 right-3 z-10 flex items-center pointer-events-none">
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </Card>
        ))}

        {/* 확인 및 일괄 판매 버튼 (성공한 항목 또는 일부 실패 항목이 있을 때만 표시) */}
        {(successItems.length > 0 || partialFailedItems.length > 0) && (
          <div className="flex flex-col gap-3 pt-4">
            {hasFailedItems && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-2">
                <p className="text-sm text-destructive text-center">
                  인식 실패 항목을 처리한 후 등록할 수 있습니다.
                </p>
              </div>
            )}
            <Button
              onClick={handleConfirm}
              disabled={isProcessing || hasFailedItems}
              className={`w-full h-14 text-lg font-semibold rounded-xl transition-all ${
                hasFailedItems 
                  ? 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground' 
                  : ''
              }`}
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  처리 중...
                </>
              ) : (
                "확인"
              )}
            </Button>
            <Button
              onClick={handleBulkSell}
              disabled={isProcessing || hasFailedItems}
              variant="outline"
              className={`w-full h-12 text-base font-medium rounded-xl transition-all ${
                hasFailedItems 
                  ? 'opacity-50 cursor-not-allowed border-muted text-muted-foreground' 
                  : ''
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  처리 중...
                </>
              ) : (
                "일괄 판매"
              )}
            </Button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default SellResult;