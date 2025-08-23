import type { ReactNode } from 'react';

type Props = {
  left: ReactNode;
  right: ReactNode;
};

export function ListDetailLayout(props: Props) {
  const { left, right } = props;
  return (
    <div className="flex h-[calc(100vh-47px)]">
      <div className="w-62 border-r flex flex-col">
        {left}
      </div>
      <div className="flex-1 overflow-auto p-4 routeFadeWrapper grid justify-items-center">
        <div className="w-full max-w-3xl">
          {right}
        </div>
      </div>
    </div>
  );
}

export default ListDetailLayout;


