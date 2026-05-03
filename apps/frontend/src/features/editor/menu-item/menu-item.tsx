import useLayoutStore from "../store/use-layout-store";
import { Transitions } from "./transitions";
import { Texts } from "./texts";
import { Audios } from "./audios";
import { Elements } from "./elements";
import { Uploads } from "./uploads";

const ActiveMenuItem = () => {
  const { activeMenuItem } = useLayoutStore();

  if (activeMenuItem === "transitions") {
    return <Transitions />;
  }
  if (activeMenuItem === "texts") {
    return <Texts />;
  }
  if (activeMenuItem === "shapes") {
    return <Elements />;
  }

  if (activeMenuItem === "audios") {
    return <Audios />;
  }
  if (activeMenuItem === "elements") {
    return <Elements />;
  }
  if (activeMenuItem === "uploads") {
    return <Uploads />;
  }

  return null;
};

export const MenuItem = () => {
  return (
    <div className={`w-full flex-1 flex h-[calc(100%-50px)]`}>
      <ActiveMenuItem />
    </div>
  );
};
