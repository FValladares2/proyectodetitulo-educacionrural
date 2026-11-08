/**
 * Prueba de integración del perfil, la edición de organizaciones, la configuración de
 * asignaturas y el modo de solo lectura de las asignaturas inactivas, contra un MongoDB real.
 * Se ejecuta solo si MONGO_TEST_URI está definido (ver tests/tareas.integration.test.js).
 */
const MONGO_TEST_URI = process.env.MONGO_TEST_URI;
const describeConMongo = MONGO_TEST_URI ? describe : describe.skip;

if (MONGO_TEST_URI) {
  process.env.MONGODB_URI = MONGO_TEST_URI;
  process.env.MONGODB_DB = `prueba_configuracion_${Date.now()}`;
}

const express = require("express");
const request = require("supertest");
const { ObjectId: mockObjectId } = require("mongodb");

const mockUsuarios = {
  admin: new mockObjectId(),
  docente: new mockObjectId(),
  ana: new mockObjectId(),
};

// la sesión se simula con "Bearer <usuario>"; se carga el usuario real para tener su contraseña
jest.mock("../utils/auth", () => {
  const cargar = async (token) => {
    const { collections } = require("../config/mongo");
    return collections.usuarios.findOne({ _id: mockUsuarios[token] });
  };
  return {
    authenticate: async (req, res, next) => {
      req.user = await cargar((req.headers.authorization || "").split(" ")[1]);
      next();
    },
    getUserFromToken: jest.fn(cargar),
    createToken: jest.fn(() => "token-nuevo"),
  };
});

const mongo = require("../config/mongo");
const userServices = require("../services/userServices");

const app = express();
app.use(express.json());
app.use(require("../routes/apiRoutes"));

const HORA = 60 * 60 * 1000;

const como = (usuario) => {
  const auth = (r) => r.set("Authorization", `Bearer ${usuario}`);
  return {
    get: (url) => auth(request(app).get(url)),
    post: (url, body) => auth(request(app).post(url)).send(body),
    put: (url, body) => auth(request(app).put(url)).send(body),
    subir: (campos, nombre = "guia.pdf") => {
      let r = auth(request(app).post("/api/recurso/upload"));
      for (const [k, v] of Object.entries(campos)) r = r.field(k, String(v));
      return r.attach("file", Buffer.from("contenido"), {
        filename: nombre,
        contentType: "application/pdf",
      });
    },
  };
};

describeConMongo("configuración y asignaturas inactivas (MongoDB real)", () => {
  let ORG;
  let ASIGNATURA;
  let TAREA;
  const u = mockUsuarios;

  beforeAll(async () => {
    await mongo.connectMongo();
    const { collections } = mongo;
    const hash_contrasena =
      await userServices.hashPassword("contrasena-segura");
    await collections.usuarios.insertMany(
      Object.entries(u).map(([nombre, _id]) => ({
        _id,
        nombre,
        correo: `${nombre}@prueba.cl`,
        hash_contrasena,
      })),
    );
    ORG = (
      await collections.organizaciones.insertOne({
        nombre: "Escuela Rural",
        usuarios: Object.values(u),
        administradores: [u.admin],
        profesores: [u.admin, u.docente],
      })
    ).insertedId;
    ASIGNATURA = (
      await collections.asignaturas.insertOne({
        nombre: "Ciencias",
        id_organizacion: ORG,
        activo: true,
        docentes: [u.docente],
        usuarios: [u.docente, u.ana],
      })
    ).insertedId;
    const tarea = await como("docente").post("/api/tarea", {
      id_asignatura: String(ASIGNATURA),
      titulo: "Guía 1",
      apertura: new Date(Date.now() - HORA).toISOString(),
      limite: new Date(Date.now() + 24 * HORA).toISOString(),
    });
    TAREA = tarea.body._id;
  });

  afterAll(async () => {
    if (mongo.isMongoConnected()) {
      await mongo.client.db(process.env.MONGODB_DB).dropDatabase();
    }
    await mongo.client.close();
  });

  test("registrarse crea la organización con su asignatura tutorial", async () => {
    const res = await request(app).post("/api/auth/register").send({
      nombre: "Nueva Admin",
      correo: "nueva@prueba.cl",
      contrasena: "contrasena-segura",
      nombre_organizacion: "Escuela Nueva",
    });
    expect(res.status).toBe(201);

    const usuario = await mongo.collections.usuarios.findOne({
      correo: "nueva@prueba.cl",
    });
    const tutorial = await mongo.collections.asignaturas.findOne({
      id_organizacion: usuario.org_principal,
    });
    expect(tutorial).toMatchObject({
      nombre: "Introducción al aula digital",
      activo: true,
      tutorial: true,
    });
    expect(tutorial.docentes.map(String)).toEqual([String(usuario._id)]);
    expect(tutorial.formato_markup).toMatch(/^# Introducción al aula digital/);
    // todas las referencias de la plantilla quedaron resueltas
    expect(tutorial.formato_markup).not.toMatch(/plantilla(-tarea)?:/);

    // cada archivo usado es un recurso de la asignatura (una vez aunque se use dos veces)
    const recursos = await mongo.collections.recursos
      .find({ id_asignatura: tutorial._id })
      .toArray();
    expect(recursos.map((r) => r.nombre).sort()).toEqual(
      [
        "1.png",
        "2.png",
        "3.png",
        "4.png",
        "5.png",
        "6.png",
        "7.png",
        "cat-fire-3989839543.gif",
      ].sort(),
    );
    for (const recurso of recursos) {
      expect(tutorial.formato_markup).toContain(`recurso:${recurso._id}`);
    }

    // se descifra con los mismos bytes del archivo de la plantilla
    const gif = recursos.find((r) => r.nombre.endsWith(".gif"));
    const { descifrarRecurso } = require("../services/recursoServices");
    const contenido = Buffer.from(
      await descifrarRecurso(gif.recurso, gif.id_usuario),
      "base64",
    );
    const original = require("fs").readFileSync(
      require("path").join(
        __dirname,
        "..",
        "plantillas",
        "tutorial",
        "cat-fire-3989839543.gif",
      ),
    );
    expect(contenido.equals(original)).toBe(true);
    expect(gif.tipo_mime).toBe("image/gif");

    const tareas = await mongo.collections.tareas
      .find({ id_asignatura: tutorial._id })
      .toArray();
    expect(tareas).toHaveLength(1);
    expect(tareas[0].titulo).toBe("Tarea de ejemplo");
    expect(tutorial.formato_markup).toContain(`tarea:${tareas[0]._id}`);
    expect(tareas[0].limite.getTime()).toBeGreaterThan(Date.now());
  });

  test("se inicia sesión solo con el correo, sin importar mayúsculas", async () => {
    const login = (body) => request(app).post("/api/auth/login").send(body);
    expect(
      (
        await login({
          correo: "ANA@prueba.cl",
          contrasena: "contrasena-segura",
        })
      ).status,
    ).toBe(200);
    expect(
      (await login({ nombre: "ana", contrasena: "contrasena-segura" })).status,
    ).toBe(400);
    expect(
      (await login({ correo: "ana", contrasena: "contrasena-segura" })).status,
    ).toBe(401);
  });

  test("cada usuario edita su nombre; el correo no cambia", async () => {
    const res = await como("ana").put("/api/usuario/perfil", {
      nombre: "  Ana   Pérez ",
      correo: "otro@prueba.cl",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nombre: "Ana Pérez",
      correo: "ana@prueba.cl",
    });
    expect(
      (await como("ana").put("/api/usuario/perfil", { nombre: "   " })).status,
    ).toBe(400);
  });

  test("cambiar la contraseña exige la actual y marca desde cuándo valen las sesiones", async () => {
    const incorrecta = await como("ana").put("/api/usuario/contrasena", {
      actual: "otra",
      nueva: "nueva-contrasena",
    });
    expect(incorrecta.status).toBe(400);
    expect(
      (
        await como("ana").put("/api/usuario/contrasena", {
          actual: "contrasena-segura",
          nueva: "corta",
        })
      ).status,
    ).toBe(400);

    const res = await como("ana").put("/api/usuario/contrasena", {
      actual: "contrasena-segura",
      nueva: "nueva-contrasena",
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBe("token-nuevo");
    const ana = await mongo.collections.usuarios.findOne({ _id: u.ana });
    expect(ana.sesiones_validas_desde).toBeInstanceOf(Date);

    const login = (contrasena) =>
      request(app)
        .post("/api/auth/login")
        .send({ correo: "ana@prueba.cl", contrasena });
    expect((await login("contrasena-segura")).status).toBe(401);
    expect((await login("nueva-contrasena")).status).toBe(200);
  });

  test("solo los administradores editan la organización; un campo vacío se borra", async () => {
    expect(
      (await como("docente").put(`/api/org/${ORG}`, { nombre: "Otra" })).status,
    ).toBe(403);

    const res = await como("admin").put(`/api/org/${ORG}`, {
      nombre: "Escuela Rural Los Robles",
      descripcion: "Escuela básica multigrado.",
      direccion: "Camino a Quillón km 12",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nombre: "Escuela Rural Los Robles",
      direccion: "Camino a Quillón km 12",
    });

    const borrar = await como("admin").put(`/api/org/${ORG}`, {
      direccion: "",
    });
    expect(borrar.body).not.toHaveProperty("direccion");
    expect(
      (await como("admin").put(`/api/org/${ORG}`, { nombre: " " })).status,
    ).toBe(400);
  });

  test("docentes y administradores configuran la asignatura; los estudiantes no", async () => {
    expect(
      (await como("ana").get(`/api/asign/${ASIGNATURA}/config`)).status,
    ).toBe(403);
    expect(
      (await como("admin").get(`/api/asign/${ASIGNATURA}/config`)).body,
    ).toMatchObject({ nombre: "Ciencias", activo: true });

    const res = await como("docente").put(`/api/asign/${ASIGNATURA}/config`, {
      nombre: "Ciencias Naturales",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nombre: "Ciencias Naturales",
      activo: true,
    });
    expect(
      (
        await como("docente").put(`/api/asign/${ASIGNATURA}/config`, {
          activo: "no",
        })
      ).status,
    ).toBe(400);
  });

  test("una asignatura inactiva es de solo lectura, salvo calificar y reactivarla", async () => {
    // una entrega enviada mientras estaba activa
    expect(
      (await como("ana").subir({ id_tarea: TAREA }, "respuesta.pdf")).status,
    ).toBe(201);
    expect((await como("ana").post(`/api/tarea/${TAREA}/entrega`)).status).toBe(
      201,
    );

    expect(
      (
        await como("docente").put(`/api/asign/${ASIGNATURA}/config`, {
          activo: false,
        })
      ).status,
    ).toBe(200);

    // se puede ver
    expect((await como("ana").get(`/api/asign/${ASIGNATURA}`)).status).toBe(
      200,
    );
    const mia = await como("ana").get(`/api/tarea/${TAREA}/mi-entrega`);
    expect(mia.body).toMatchObject({
      asignaturaInactiva: true,
      puedeEditarArchivos: false,
    });

    // no se puede editar ni entregar
    const inactiva = [
      await como("docente").put(`/api/asign/${ASIGNATURA}`, {
        formato_markup: "# Nuevo",
      }),
      await como("docente").put(`/api/asign/${ASIGNATURA}/img`, { img: null }),
      await como("docente").subir({ id_asignatura: ASIGNATURA }),
      await como("docente").post("/api/tarea", {
        id_asignatura: String(ASIGNATURA),
        titulo: "Guía 2",
        apertura: new Date().toISOString(),
        limite: new Date(Date.now() + HORA).toISOString(),
      }),
      await como("docente").put(`/api/tarea/${TAREA}`, {
        titulo: "Guía 1 (editada)",
      }),
      await request(app)
        .delete(`/api/tarea/${TAREA}`)
        .set("Authorization", "Bearer docente"),
      await request(app)
        .delete(`/api/tarea/${TAREA}/entrega`)
        .set("Authorization", "Bearer ana"),
    ];
    for (const res of inactiva) {
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/inactiva/);
    }

    // calificar sigue permitido
    const nota = await como("docente").put(
      `/api/tarea/${TAREA}/entregas/${u.ana}`,
      { calificacion: 6 },
    );
    expect(nota.status).toBe(200);

    expect(
      (
        await como("docente").put(`/api/asign/${ASIGNATURA}/config`, {
          activo: true,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await como("docente").put(`/api/asign/${ASIGNATURA}`, {
          formato_markup: "# Nuevo",
        })
      ).status,
    ).toBe(200);
  });

  describe("almacenamiento", () => {
    let HISTORIA;
    let resumenOrg;

    beforeAll(async () => {
      const { collections } = mongo;
      HISTORIA = (
        await collections.asignaturas.insertOne({
          nombre: "Historia",
          id_organizacion: ORG,
          activo: false,
          docentes: [u.docente],
          usuarios: [u.docente, u.ana],
        })
      ).insertedId;
      const tarea = (
        await collections.tareas.insertOne({ id_asignatura: HISTORIA, titulo: "Ensayo" })
      ).insertedId;
      // el contenido simula el archivo cifrado, más grande que el original
      await collections.recursos.insertMany([
        { id_asignatura: HISTORIA, nombre: "guia.pdf", tamano: 1000, recurso: "x".repeat(1400) },
        { id_asignatura: HISTORIA, nombre: "mapa.png", tamano: 500, recurso: "x".repeat(700) },
        { id_tarea: tarea, id_usuario: u.ana, nombre: "ensayo.pdf", tamano: 200, recurso: "x".repeat(300) },
        { id_organizacion: ORG, nombre: "logo.png", tamano: 300, recurso: "x".repeat(400) },
      ]);
      resumenOrg = await como("admin").get(`/api/org/${ORG}/almacenamiento`);
    });

    test("el administrador ve el espacio de cada asignatura, separado en material y entregas", () => {
      expect(resumenOrg.status).toBe(200);
      expect(resumenOrg.body.limite).toBe(512 * 1024 * 1024);
      const historia = resumenOrg.body.asignaturas.find((a) => a._id === String(HISTORIA));
      expect(historia).toMatchObject({
        nombre: "Historia",
        activo: false,
        material: { archivos: 2, tamano: 1500 },
        entregas: { archivos: 1, tamano: 200 },
        total: { archivos: 3, tamano: 1700 },
      });
      // lo almacenado incluye el documento completo, así que siempre supera al original
      expect(historia.material.almacenado).toBeGreaterThan(1400 + 700);
      expect(historia.total.almacenado).toBe(historia.material.almacenado + historia.entregas.almacenado);
    });

    test("el total suma los archivos de la organización y los de todas sus asignaturas", () => {
      const { total, organizacion, asignaturas } = resumenOrg.body;
      expect(organizacion.archivos).toBeGreaterThanOrEqual(1);
      expect(organizacion.tamano).toBeGreaterThanOrEqual(300);
      // Ciencias (renombrada en una prueba anterior) e Historia
      expect(asignaturas).toHaveLength(2);
      for (const campo of ["archivos", "tamano", "almacenado"]) {
        const suma = asignaturas.reduce((acc, a) => acc + a.total[campo], organizacion[campo]);
        expect(total[campo]).toBe(suma);
      }
    });

    test("solo los administradores ven el almacenamiento de la organización", async () => {
      expect((await como("docente").get(`/api/org/${ORG}/almacenamiento`)).status).toBe(403);
      expect((await como("ana").get(`/api/org/${ORG}/almacenamiento`)).status).toBe(403);
      expect((await como("admin").get("/api/org/no-es-id/almacenamiento")).status).toBe(400);
    });

    test("la configuración de la asignatura incluye su espacio usado", async () => {
      const config = await como("docente").get(`/api/asign/${HISTORIA}/config`);
      expect(config.status).toBe(200);
      expect(config.body.almacenamiento).toMatchObject({
        material: { archivos: 2, tamano: 1500 },
        entregas: { archivos: 1, tamano: 200 },
      });
    });
  });
});
