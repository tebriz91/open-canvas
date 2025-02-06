import { ThreadPrimitive, useThreadRuntime } from "@assistant-ui/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FC } from "react";
import { TighterText } from "../ui/header";
import { NotebookPen } from "lucide-react";
import { Button } from "../ui/button";

interface QuickStartButtonsProps {
  handleQuickStart: (
    type: "text",
  ) => void;
  composer: React.ReactNode;
}

const QuickStartPrompts = () => {
  const threadRuntime = useThreadRuntime();

  const handleClick = (text: string) => {
    threadRuntime.append({
      role: "user",
      content: [{ type: "text", text }],
    });
  };

  return (
    <div className="flex flex-col w-full gap-2 text-gray-700">
      <div className="flex gap-2 w-full">
        <Button
          onClick={(e) =>
            handleClick((e.target as HTMLButtonElement).textContent || "")
          }
          variant="outline"
          className="flex-1"
        >
          <TighterText>Составь претензию к компании за нарушение условий договора</TighterText>
        </Button>
        <Button
          onClick={(e) =>
            handleClick((e.target as HTMLButtonElement).textContent || "")
          }
          variant="outline"
          className="flex-1"
        >
          <TighterText>
            Подготовь исковое заявление в суд
          </TighterText>
        </Button>
      </div>
      <div className="flex gap-2 w-full">
        <Button
          onClick={(e) =>
            handleClick((e.target as HTMLButtonElement).textContent || "")
          }
          variant="outline"
          className="flex-1"
        >
          <TighterText>
            Составь договор поставки с компанией
          </TighterText>
        </Button>
        <Button

          onClick={(e) =>
            handleClick((e.target as HTMLButtonElement).textContent || "")
          }
          variant="outline"
          className="flex-1"
        >
          <TighterText>Составь план подготовки к судебному заседанию</TighterText>
        </Button>
      </div>
    </div>
  );
};

const QuickStartButtons = (props: QuickStartButtonsProps) => {

  return (
    <div className="flex flex-col gap-8 items-center justify-center w-full">
      <div className="flex flex-col gap-6">
        <p className="text-gray-600 text-sm">Начните с чистого листа</p>
        <div className="flex flex-row gap-1 items-center justify-center w-full">
          <Button
            variant="outline"
            className="transition-colors text-gray-600 flex items-center justify-center gap-2 w-[250px] h-[64px]"
            onClick={() => props.handleQuickStart("text")}
          >
            <TighterText>Новый документ</TighterText>
            <NotebookPen />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-6 mt-2 w-full">
        <p className="text-gray-600 text-sm">или с заготовленного шаблона</p>
        <QuickStartPrompts />
        {props.composer}
      </div>
    </div>
  );
};

interface ThreadWelcomeProps {
  handleQuickStart: (
    type: "text",
  ) => void;
  composer: React.ReactNode;

}

export const ThreadWelcome: FC<ThreadWelcomeProps> = (
  props: ThreadWelcomeProps
) => {
  return (
    <ThreadPrimitive.Empty>
      <div className="flex items-center justify-center mt-16 w-full">
        <div className="text-center max-w-3xl w-full">
          <Avatar className="mx-auto">
            <AvatarImage src="/lc_logo.jpg" alt="LangChain Logo" />
            <AvatarFallback>LC</AvatarFallback>
          </Avatar>
          <TighterText className="mt-4 text-lg font-medium">
            Чем я могу помочь?
          </TighterText>
          <div className="mt-8 w-full">
            <QuickStartButtons

              composer={props.composer}
              handleQuickStart={props.handleQuickStart}
            />
          </div>
        </div>
      </div>
    </ThreadPrimitive.Empty>
  );
};
