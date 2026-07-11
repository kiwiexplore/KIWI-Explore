import { useKiwiStore } from "../../state/kiwi";
import "./StatusBar.css";

export default function StatusBar() {

    const version = useKiwiStore((state) => state.version);
    const status = useKiwiStore((state) => state.status);
    const activeModule = useKiwiStore((state) => state.activeModule);

    return (

        <div className="status-bar">

            <span>
                Version: {version}
            </span>

            <span>
                Status: {status}
            </span>

            <span>
                Module: {activeModule}
            </span>

        </div>

    );

}
