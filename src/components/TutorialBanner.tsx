import { Alert } from "@/components/ui/alert";

const TutorialBanner = () => {
  // 튜토리얼 모드에서는 항상 튜토리얼 배너 표시
  return (
    <Alert className="bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400 rounded-none border-x-0 border-t-0">
      <div className="flex items-center justify-center py-2">
        <span className="font-semibold">📚 튜토리얼 진행중 (실제 구매가 일어나지 않습니다)</span>
      </div>
    </Alert>
  );
};

export default TutorialBanner;
