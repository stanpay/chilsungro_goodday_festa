import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { useSendSupportMessage } from "@/hooks/use-support";

interface Message {
  id: number;
  text: string;
  sender: "user" | "support";
  timestamp: Date;
}

const ChatSupport = () => {
  const location = useLocation();
  const chatRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isTutorial = location.pathname.includes("/tutorial");

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "안녕하세요! 스탠 고객지원팀입니다. 무엇을 도와드릴까요?\n\n문제 발생 시 010-8767-5708로 연락주세요",
      sender: "support",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [includeCurrentPage, setIncludeCurrentPage] = useState(true);

  const sendMessage = useSendSupportMessage();

  const getPageName = (path: string) => {
    const pageNames: Record<string, string> = {
      "/": "메인",
      "/main": "메인",
      "/location": "위치 설정",
      "/sell": "판매하기",
      "/payment": "결제",
      "/mypage": "마이페이지",
      "/my-gifticons": "내 기프티콘",
      "/history": "결제 내역",
      "/payment-methods": "결제 수단",
    };
    const basePath = "/" + path.split("/")[1];
    return pageNames[basePath] || pageNames[path] || "기타";
  };

  const currentPageName = getPageName(location.pathname);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (location.pathname.startsWith("/admin") || isTutorial) return null;

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: messages.length + 1,
      text: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    const messageText = inputValue;
    setInputValue("");

    try {
      await sendMessage.mutateAsync({
        message: messageText,
        pageName: includeCurrentPage ? currentPageName : "기타",
        pagePath: location.pathname,
      });
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "메시지 저장 실패", description: "메시지 저장 중 오류가 발생했습니다.", variant: "destructive" });
    }

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          text: "문의해주셔서 감사합니다. 담당자가 확인 후 빠른 시일 내에 답변드리겠습니다.",
          sender: "support",
          timestamp: new Date(),
        },
      ]);
    }, 1000);
  };

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-[calc(4rem+30px-1.75rem)] right-6 z-50 h-14 w-14 rounded-full shadow-lg"
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {isOpen && (
        <Card
          ref={chatRef}
          className="fixed bottom-[calc(4rem+30px-1.75rem)] left-4 right-4 z-50 flex h-[500px] max-w-md flex-col animate-scale-in shadow-2xl md:right-6 md:left-auto md:w-96"
        >
          <div className="flex items-center justify-between p-4 border-b border-border bg-primary text-primary-foreground rounded-t-lg">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <div>
                <h3 className="font-semibold">1:1 상담</h3>
                <p className="text-xs opacity-90">스탠 고객지원팀</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-primary-foreground hover:bg-primary-foreground/20">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${message.sender === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="px-4 py-2 border-t border-border">
            <Badge variant={includeCurrentPage ? "default" : "outline"} className="cursor-pointer" onClick={() => setIncludeCurrentPage(!includeCurrentPage)}>
              {currentPageName} 페이지 {includeCurrentPage ? "✓" : ""}
            </Badge>
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="메시지를 입력하세요..."
                className="flex-1 min-h-[80px] resize-none"
              />
              <Button onClick={handleSend} size="icon" disabled={sendMessage.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
};

export default ChatSupport;
