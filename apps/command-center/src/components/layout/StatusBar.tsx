import { kiwiState } from "../../state/kiwi";
import "./StatusBar.css";

export default function StatusBar() {

    return (

        <div className="status-bar">

            <span>
                Version: {kiwiState.version}
            </span>

            <span>
                Status: {kiwiState.status}
            </span>

            <span>
                Module: {kiwiState.activeModule}
            </span>

        </div>

    );

}