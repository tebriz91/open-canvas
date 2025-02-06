import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { TighterText } from "../ui/header";

export interface ReflectionsProps {
  handleDeleteReflections: () => Promise<boolean>;
}

export function ConfirmClearDialog(props: ReflectionsProps) {
  const { handleDeleteReflections } = props;
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)} variant="destructive">
          <TighterText>Очистить размышления</TighterText>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl p-8 bg-white rounded-lg shadow-xl">

        <DialogHeader>
          <DialogDescription className="mt-2 text-md text-center font-light text-red-500">
            <TighterText>
              Вы уверены, что хотите очистить все размышления? Это действие нельзя отменить.
            </TighterText>
          </DialogDescription>

        </DialogHeader>
        <Button
          onClick={async () => {
            setOpen(false);
            await handleDeleteReflections();
          }}
          variant="destructive"
        >
          <TighterText>Очистить размышления</TighterText>
        </Button>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setOpen(false)} variant="outline">

            <TighterText>Отменить</TighterText>
          </Button>
        </div>
      </DialogContent>

    </Dialog>
  );
}
