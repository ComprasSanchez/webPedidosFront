const Modal = ({ children, onClose }) => {
    return (
        <div className="modal_overlay">
            <div className="modal_contenido">
                <button className="modal_cerrar" onClick={onClose}>×</button>
                {children}
            </div>
        </div>
    );
};

export default Modal;
