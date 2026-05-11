import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Upload, ArrowLeft, Loader2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { recognizeGifticon } from "@/lib/gifticonRecognition";

const Sell = () => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();


  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 미리보기
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setUploadedFile(file);

    // 이미지 업로드 및 인식 처리
    await processImage(file);
  };

  const processImage = async (file: File) => {
    try {
      setIsProcessing(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("세션이 필요합니다. 페이지를 새로고침해주세요.");
        return;
      }

      // 1. File을 Base64로 변환
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 2. 인식 작업 생성 (status: 'processing', jobId 받기)
      const { data: jobData, error: jobError } = await supabase
        .from('gifticon_recognition_jobs')
        .insert({
          user_id: session.user.id,
          status: 'processing',
        })
        .select()
        .single();

      if (jobError || !jobData) {
        throw jobError || new Error('인식 작업 생성 실패');
      }

      // 3. 이미지를 로컬 스토리지에 저장 (키: gifticon_image_${jobId})
      localStorage.setItem(`gifticon_image_${jobData.id}`, base64Image);

      // 4. 더미 인식 데이터 생성
      const recognitionResult = await recognizeGifticon(file);

      // 5. 인식 결과를 테이블에 업데이트 (status: 'completed')
      const { error: updateError } = await supabase
        .from('gifticon_recognition_jobs')
        .update({
          status: 'completed',
          recognition_result: recognitionResult,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobData.id);

      if (updateError) {
        throw updateError;
      }

      // 6. 로컬 스토리지에 pending_job_id 저장 (미완료 상태 추적용)
      localStorage.setItem('pending_recognition_job_id', jobData.id);

      // 7. 인식 결과 페이지로 이동
      navigate(`/sell/result/${jobData.id}`);
      toast.success("이미지 인식이 완료되었습니다!");

    } catch (error: any) {
      console.error('이미지 처리 오류:', error);
      toast.error(error.message || '이미지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">기프티콘 판매</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">이미지 인식중입니다.</p>
              <p className="text-muted-foreground">인식이 끝나면 알려드릴게요</p>
            </div>
            <Button
              onClick={() => navigate("/main")}
              variant="outline"
              className="mt-4"
            >
              메인으로 이동
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Image Upload */}
            <div>
              <Label htmlFor="image" className="text-base font-semibold mb-3 block">
                기프티콘 이미지
              </Label>
              <Card className="border-2 border-dashed border-border hover:border-primary transition-colors cursor-pointer">
                <label htmlFor="image" className="cursor-pointer">
                  <div className="aspect-video flex flex-col items-center justify-center p-8 relative">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground text-center">
                          이미지를 업로드하세요
                        </p>
                      </>
                    )}
                  </div>
                </label>
                <input
                  id="image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={isProcessing}
                />
              </Card>
              {imagePreview && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  이미지를 업로드하면 자동으로 인식됩니다
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Sell;
