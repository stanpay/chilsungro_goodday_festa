import { useState } from "react";
import { MapPin, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface LocationPermissionModalProps {
  open: boolean;
  onGranted: (coords: { latitude: number; longitude: number }) => void;
}

const LocationPermissionModal = ({ open, onGranted }: LocationPermissionModalProps) => {
  const [status, setStatus] = useState<"idle" | "loading" | "denied">("idle");

  const handleAllow = () => {
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStatus("idle");
        onGranted({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      (err) => {
        console.warn("위치 권한 거부:", err.message);
        setStatus("denied");
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 }
    );
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideClose
      >
        <DialogHeader className="items-center gap-3 pt-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <MapPin className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center text-lg font-bold">
            위치 권한이 필요합니다
          </DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            주변 매장을 찾으려면 현재 위치를 알아야 해요.
            <br />
            브라우저에서 위치 접근을 허용해 주세요.
          </DialogDescription>
        </DialogHeader>

        {status === "denied" && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              위치 권한이 거부되었습니다. 브라우저 주소창 옆 자물쇠 아이콘을 눌러 위치
              권한을 허용한 뒤 새로고침해 주세요.
            </span>
          </div>
        )}

        <Button
          className="w-full"
          onClick={handleAllow}
          disabled={status === "loading" || status === "denied"}
        >
          {status === "loading" ? "확인 중…" : "위치 허용하기"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default LocationPermissionModal;
