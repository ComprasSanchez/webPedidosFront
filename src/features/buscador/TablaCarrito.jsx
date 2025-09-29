import { useCarrito } from "../../context/CarritoContext";
import CarritoNormal from "../../components/ui/CarritoNormal";
import CarritoBulk from "../../components/ui/CarritoBulk";

const TablaCarrito = ({ eanRecienAgregado }) => {
    const {
        carrito,
        eliminarDelCarrito,
        actualizarUnidades,
        vaciarCarrito,
        modoBulk,
        carritosBulk,
        obtenerTotalProductosBulk,
        obtenerTotalUnidadesBulk
    } = useCarrito();

    // Si estamos en modo bulk, mostrar la vista de resumen por sucursales
    if (modoBulk && Object.keys(carritosBulk).length > 0) {
        const totalSucursales = Object.keys(carritosBulk).length;
        const totalProductos = obtenerTotalProductosBulk();
        const totalUnidades = obtenerTotalUnidadesBulk();

        return (
            <CarritoBulk
                carritosBulk={carritosBulk}
                totalSucursales={totalSucursales}
                totalProductos={totalProductos}
                totalUnidades={totalUnidades}
            />
        );
    }

    return (
        <CarritoNormal
            carrito={carrito}
            eliminarDelCarrito={eliminarDelCarrito}
            actualizarUnidades={actualizarUnidades}
            vaciarCarrito={vaciarCarrito}
            eanRecienAgregado={eanRecienAgregado}
        />
    );
};

export default TablaCarrito;