import { FaQuestionCircle } from "react-icons/fa";

export default function HelpButton() {
    return (
        <a
            href="https://docs.google.com/document/d/1Lq5l-FIfWId0BJVuHrpp3KKVR53ae63Oc43uovdHRH0/edit?tab=t.0"
            target="_blank"
            rel="noopener noreferrer"
            className="help-button"
        >
            <FaQuestionCircle size={40} />
        </a>
    );
}
