import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { useSendSupportMessage } from "@/hooks/use-support";
import { useAppLocale } from "@/contexts/AppLocaleContext";
import { chatSupportStrings } from "@/lib/locale";
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
    const { locale } = useAppLocale();
    const t = chatSupportStrings(locale);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const sendMessage = useSendSupportMessage();
    // 언어가 바뀌면 초기 메시지도 해당 언어로 갱신
    useEffect(() => {
        setMessages([
            {
                id: 1,
                text: t.greeting,
                sender: "support",
                timestamp: new Date(),
            },
        ]);
    }, [locale]);
    const getPageName = (path: string) => {
        const basePath = "/" + path.split("/")[1];
        return t.pageNames[basePath] ?? t.pageNames[path] ?? t.pageNames["/"]?.replace(/.*/, "") ?? "기타";
    };
    const currentPageName = getPageName(location.pathname);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen)
            document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);
    if (location.pathname.startsWith("/admin") || isTutorial)
        return null;
    const handleSend = async () => {
        if (!inputValue.trim())
            return;
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
                pageName: currentPageName,
                pagePath: location.pathname,
            });
        }
        catch (error) {
            toast({ title: t.sendErrorTitle, description: t.sendErrorDesc, variant: "destructive" });
        }
        setTimeout(() => {
            setMessages((prev) => [
                ...prev,
                {
                    id: prev.length + 1,
                    text: t.autoReply,
                    sender: "support",
                    timestamp: new Date(),
                },
            ]);
        }, 1000);
    };
    return (<>
      {!isOpen && (<Button onClick={() => setIsOpen(true)} className="fixed bottom-[calc(4rem+30px-1.75rem)] right-6 z-50 h-14 w-14 rounded-full shadow-lg" size="icon">
          <MessageCircle className="h-6 w-6"/>
        </Button>)}

      {isOpen && (<Card ref={chatRef} className="fixed bottom-[calc(4rem+30px-1.75rem)] left-4 right-4 z-50 flex h-[500px] max-w-md flex-col animate-scale-in shadow-2xl md:right-6 md:left-auto md:w-96">
          <div className="flex items-center justify-between p-4 border-b border-border bg-primary text-primary-foreground rounded-t-lg">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5"/>
              <div>
                <h3 className="font-semibold">{t.title}</h3>
                <p className="text-xs opacity-90">{t.subtitle}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-primary-foreground hover:bg-primary-foreground/20">
              <X className="h-5 w-5"/>
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (<div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${message.sender === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString(locale === "ko" ? "ko-KR" : locale === "ja" ? "ja-JP" : locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>))}
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyPress={(e) => { if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        } }} placeholder={t.inputPlaceholder} className="flex-1 min-h-[80px] resize-none"/>
              <Button onClick={handleSend} size="icon" disabled={sendMessage.isPending}>
                <Send className="h-4 w-4"/>
              </Button>
            </div>
          </div>
        </Card>)}
    </>);
};
export default ChatSupport;
