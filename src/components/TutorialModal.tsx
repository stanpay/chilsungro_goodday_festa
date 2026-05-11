import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

const TutorialModal = ({ open, onClose }: TutorialModalProps) => {
  const navigate = useNavigate();

  const handleRealStore = () => {
    // 모달만 닫기 (이미 /main에 있음)
    onClose();
  };

  const handleDemoStore = () => {
    // 튜토리얼 페이지로 이동
    navigate("/tutorial");
    onClose();
  };

  // X 버튼 클릭 또는 배경 클릭 시 처리
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            실제 매장이신가요?
          </DialogTitle>
          <DialogDescription className="text-center">
            매장 유형을 선택하여 결제 프로세스를 체험해보세요.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-4">
          <Button
            onClick={handleRealStore}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            예, 지금 바로 무료로 첫구매 하기
          </Button>
          <Button
            onClick={handleDemoStore}
            variant="outline"
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            아니오, 튜토리얼 먼저 해볼게요
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TutorialModal;
