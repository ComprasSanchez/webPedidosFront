export const sucursales = [
    {
        id: 1,
        nombre: "Sucursal Centro",
        usuario: "centro",
        contrasena: "1234",
        credenciales: {
            monroe: { usuario: "centro_m", contrasena: "abc" },
            suizo: { usuario: "centro_s", contrasena: "def" },
        },
    },
    {
        id: 2,
        nombre: "Sucursal Norte",
        usuario: "norte",
        contrasena: "4321",
        credenciales: {
            monroe: { usuario: "norte_m", contrasena: "aaa" },
            suizo: { usuario: "norte_s", contrasena: "bbb" },
        },
    },
];

export const productos = [
    {
        ean: "7798855555553",
        descripcion: "Ibuprofeno 600mg x 10 comp.",
        stockDeposito: 12,
        stockSucursal: 3,
        precios: {
            deposito: 12200,
            monroe: 12400,
            suizo: 12700
        }
    },
    {
        ean: "7798745123456",
        descripcion: "Paracetamol 500mg x 20 comp.",
        stockDeposito: 5,
        stockSucursal: 0,
        precios: {
            deposito: 8900,
            monroe: 9100,
            suizo: 8990
        }
    },
];
