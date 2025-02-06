import {
  Baby,
  GraduationCap,
  PersonStanding,
  School,
} from "lucide-react";
import { ReadingLevelOptions as ReadingLevelOptionsType } from "@/types";
import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";
import { GraphInput } from "@/contexts/GraphContext";

export interface ReadingLevelOptionsProps {
  streamMessage: (params: GraphInput) => Promise<void>;
  handleClose: () => void;
}

export function ReadingLevelOptions(props: ReadingLevelOptionsProps) {
  const { streamMessage } = props;

  const handleSubmit = async (readingLevel: ReadingLevelOptionsType) => {
    props.handleClose();
    await streamMessage({
      readingLevel,
    });
  };

  return (
    <div className="flex flex-col gap-3 items-center w-full">

      <TooltipIconButton
        tooltip="Экспертный"
        variant="ghost"
        className="transition-colors w-[36px] h-[36px]"
        delayDuration={400}
        onClick={async () => await handleSubmit("экспертный")}

      >
        <GraduationCap />

      </TooltipIconButton>
      <TooltipIconButton
        tooltip="Продвинутый"
        variant="ghost"
        className="transition-colors w-[36px] h-[36px]"
        delayDuration={400}
        onClick={async () => await handleSubmit("продвинутый")}
      >
        <PersonStanding />

      </TooltipIconButton>
      <TooltipIconButton
        tooltip="Средний"
        variant="ghost"
        className="transition-colors w-[36px] h-[36px]"
        delayDuration={400}
        onClick={async () => await handleSubmit("средний")}

      >
        <School />
      </TooltipIconButton>
      <TooltipIconButton
        tooltip="Базовый"
        variant="ghost"
        className="transition-colors w-[36px] h-[36px]"
        delayDuration={400}
        onClick={async () => await handleSubmit("базовый")}

      >
        <Baby />
      </TooltipIconButton>
    </div>

  );
}
