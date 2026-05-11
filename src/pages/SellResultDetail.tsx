import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Minus, Plus, Loader2 } from "lucide-react";
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

const SellResultDetail = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<RecognitionJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [averagePrice, setAveragePrice] = useState<number | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [isRegistering, setIsRegistering] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [isPartialFailed, setIsPartialFailed] = useState(false);
  const [editableResult, setEditableResult] = useState<RecognitionResult | null>(null);

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

      setJob(data);

      if (data.status !== "completed" || !data.recognition_result) {
        toast.error("인식이 완료되지 않았습니다.");
        navigate("/sell");
        return;
      }

      const result = data.recognition_result as RecognitionResult;
      setJob(data);
      
      // 일부 실패 케이스 확인 (jobId에 "-partial"이 포함되어 있으면 일부 실패)
      const partialFailed = jobId?.includes('-partial') || false;
      setIsPartialFailed(partialFailed);
      
      // 로컬 스토리지에서 수정된 결과가 있으면 사용 (모든 경우에 대해 확인)
      let finalResult = result;
      if (jobId) {
        const savedResult = localStorage.getItem(`recognition_result_${jobId}`);
        if (savedResult) {
          try {
            finalResult = JSON.parse(savedResult);
          } catch (e) {
            console.error('수정된 결과 파싱 오류:', e);
          }
        }
      }
      setEditableResult(finalResult);
      
      // 로컬 스토리지에서 이미지 로드
      if (jobId) {
        const storedImage = localStorage.getItem(`gifticon_image_${jobId.replace('-partial', '')}`);
        setImageData(storedImage);
      }
      
      // 평균 가격 조회
      const avgPrice = await loadAveragePrice(finalResult.productName, finalResult.brand);

      // 초기 가격 설정: 로컬 스토리지에 저장된 가격이 있으면 사용, 없으면 평균 가격 또는 원가의 90%
      let initialPrice = avgPrice || Math.floor(finalResult.originalPrice * 0.9);
      if (jobId) {
        const savedPrice = localStorage.getItem(`gifticon_price_${jobId}`);
        if (savedPrice) {
          initialPrice = parseInt(savedPrice, 10);
        }
      }
      setCurrentPrice(initialPrice);

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
        setAveragePrice(avgPriceData.average_price);
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
        setAveragePrice(avg);

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
      } else {
        // 데이터가 없으면 null 반환 (원가의 90%를 기본값으로 사용)
        return null;
      }
    } catch (error) {
      console.error("평균 가격 조회 오류:", error);
      return null;
    }
  };

  const adjustPrice = (percentage: number) => {
    if (!job?.recognition_result) return;
    
    const result = editableResult || (job.recognition_result as RecognitionResult);
    const adjustment = Math.floor(result.originalPrice * (percentage / 100));
    const newPrice = currentPrice + adjustment;
    
    // 최소 0원, 최대 원가
    const clampedPrice = Math.max(0, Math.min(newPrice, result.originalPrice));
    setCurrentPrice(clampedPrice);
  };

  const handleRegister = async () => {
    if (!job?.recognition_result) return;

    const result = editableResult || (job.recognition_result as RecognitionResult);

    // 유효성 검사
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

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("세션이 필요합니다.");
        return;
      }

      // gifticons 테이블에 먼저 생성
      const { data: gifticonData, error: gifticonError } = await supabase
        .from("gifticons")
        .insert({
          user_id: session.user.id,
          brand: result.brand,
          name: result.productName,
          original_price: result.originalPrice,
          image: '', // 이미지는 로컬 스토리지에만 저장
          expiry_date: result.expiryDate || new Date().toISOString().split('T')[0],
          status: "사용가능",
          is_selling: false,
          barcode: result.barcode || null,
        })
        .select()
        .single();

      if (gifticonError || !gifticonData) {
        throw gifticonError || new Error("기프티콘 생성 실패");
      }

      // used_gifticons에 판매 정보 등록
      const { error: usedError } = await supabase
        .from("used_gifticons")
        .insert({
          id: gifticonData.id,
          seller_id: session.user.id,
          available_at: result.brand,
          name: result.productName,
          barcode: result.barcode || '',
          original_price: result.originalPrice,
          sale_price: currentPrice,
          expiry_date: result.expiryDate || new Date().toISOString().split('T')[0],
          status: '판매중'
        });

      if (usedError) {
        // 이미 존재하는 경우 업데이트
        if (usedError.code === '23505') {
          const { error: updateError } = await supabase
            .from("used_gifticons")
            .update({
              sale_price: currentPrice,
              status: '판매중'
            })
            .eq("id", gifticonData.id);

          if (updateError) {
            throw updateError;
          }
        } else {
          throw usedError;
        }
      }

      // gifticons.is_selling = true로 업데이트
      await supabase
        .from("gifticons")
        .update({ is_selling: true })
        .eq("id", gifticonData.id);

      // 평균 가격 업데이트
      await updateAveragePrice(result.productName, result.brand, currentPrice);

      // 등록 완료 후 로컬 스토리지에서 이미지 및 pending_job_id 삭제
      if (jobId) {
        localStorage.removeItem(`gifticon_image_${jobId}`);
        localStorage.removeItem(`gifticon_price_${jobId}`);
        localStorage.removeItem('pending_recognition_job_id');
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

  const updateAveragePrice = async (productName: string, brand: string, newPrice: number) => {
    try {
      // 기존 평균 가격 조회
      const { data: existingData } = await supabase
        .from("gifticon_average_prices")
        .select("average_price, sample_count")
        .eq("product_name", productName)
        .eq("brand", brand)
        .single();

      if (existingData) {
        // 기존 평균과 새 가격으로 재계산
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
        // 새로 생성
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

  if (!job || !job.recognition_result) {
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

  const result = editableResult || (job.recognition_result as RecognitionResult);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/sell/result/${jobId}`)}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold truncate">{result.productName}</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* 이미지 */}
        {imageData && (
          <Card className="p-4">
            <img
              src={imageData}
              alt="기프티콘"
              className="w-full rounded-lg"
            />
          </Card>
        )}

        {/* 인식 결과 정보 */}
        <Card className="p-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">브랜드</p>
            <input
              type="text"
              value={result.brand}
              onChange={(e) => {
                const updatedResult = { ...result, brand: e.target.value };
                setEditableResult(updatedResult);
                if (jobId) {
                  localStorage.setItem(`recognition_result_${jobId}`, JSON.stringify(updatedResult));
                }
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
                if (jobId) {
                  localStorage.setItem(`recognition_result_${jobId}`, JSON.stringify(updatedResult));
                }
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
                if (jobId) {
                  localStorage.setItem(`recognition_result_${jobId}`, JSON.stringify(updatedResult));
                }
                // 원가가 변경되면 현재 가격도 조정
                const newCurrentPrice = Math.floor(price * 0.9);
                setCurrentPrice(newCurrentPrice);
              }}
              className="text-lg font-semibold bg-transparent border-b border-border focus:border-primary focus:outline-none w-full"
            />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">유효기한</p>
            <input
              type="date"
              value={result.expiryDate || ''}
              onChange={(e) => {
                const updatedResult = { ...result, expiryDate: e.target.value };
                setEditableResult(updatedResult);
                if (jobId) {
                  localStorage.setItem(`recognition_result_${jobId}`, JSON.stringify(updatedResult));
                }
              }}
              className="text-lg font-semibold bg-transparent border-b border-border focus:border-primary focus:outline-none w-full"
            />
          </div>
        </Card>

        {/* 평균 가격 */}
        {averagePrice !== null && (
          <Card className="p-4 bg-muted/50">
            <p className="text-sm text-muted-foreground mb-1">평균 판매 가격</p>
            <p className="text-lg font-semibold">{averagePrice.toLocaleString()}원</p>
          </Card>
        )}

        {/* 가격 조정 */}
        <Card className="p-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">판매 가격</p>
            <p className="text-2xl font-bold text-primary mb-4">
              {currentPrice.toLocaleString()}원
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Button
              variant="outline"
              onClick={() => adjustPrice(-5)}
              className="h-12"
              disabled={isRegistering}
            >
              <Minus className="w-4 h-4 mr-1" />
              -5%
            </Button>
            <Button
              variant="outline"
              onClick={() => adjustPrice(-1)}
              className="h-12"
              disabled={isRegistering}
            >
              <Minus className="w-4 h-4 mr-1" />
              -1%
            </Button>
            <Button
              variant="outline"
              onClick={() => adjustPrice(1)}
              className="h-12"
              disabled={isRegistering}
            >
              <Plus className="w-4 h-4 mr-1" />
              +1%
            </Button>
            <Button
              variant="outline"
              onClick={() => adjustPrice(5)}
              className="h-12"
              disabled={isRegistering}
            >
              <Plus className="w-4 h-4 mr-1" />
              +5%
            </Button>
          </div>

          <div className="pt-2">
            <p className="text-xs text-muted-foreground text-center">
              원가 대비 {Math.round((currentPrice / result.originalPrice) * 100)}%
            </p>
          </div>
        </Card>

        {/* 등록 버튼 */}
        <Button
          onClick={handleRegister}
          disabled={isRegistering}
          className="w-full h-14 text-lg font-semibold rounded-xl"
        >
          {isRegistering ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              등록 중...
            </>
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