const Modal = ({ children, onClose }) => {
    return (
        <div className="modal_overlay">
            <div className="modal_contenido">
                {onClose && <button className="modal_cerrar" onClick={onClose}>×</button>}
                {children}
            </div>
        </div>
    );
};

export default Modal;
