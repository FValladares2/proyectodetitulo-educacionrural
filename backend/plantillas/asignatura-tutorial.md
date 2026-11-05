<!--
  Plantilla de la asignatura tutorial que se crea con cada organización nueva
  (services/tutorialServices.js). Los comentarios HTML como este no se muestran.

  - El primer título "# ..." es el nombre de la asignatura.
  - Imágenes y archivos: "plantilla:<archivo>" con un archivo de plantillas/tutorial/. Cada
    archivo se sube como recurso de la nueva asignatura y la referencia pasa a "recurso:<id>".
      ![texto alternativo](plantilla:1.png)
      <img alt="..." src="plantilla:1.png" />
      [descargar](plantilla:archivo.pdf)
  - Tareas: "plantilla-tarea:<clave>" con una clave de plantillas/tutorial/tareas.json. Cada
    tarea se crea en la nueva asignatura y la referencia pasa a "tarea:<id>".
      [Tarea de ejemplo](plantilla-tarea:ejemplo)
  - El editor no admite tablas ni bloques de código: usar listas y `código en línea`.
-->

# Introducción al aula digital

Esta asignatura presenta las funcionalidades de la plataforma y sirve como manual de uso. Su objetivo es facilitar la incorporación de nuevos usuarios y resolver las consultas más frecuentes que surgen durante el uso cotidiano.

Todo el contenido de esta asignatura fue creado con las mismas herramientas que la plataforma pone a disposición de cada usuario. Quienes tengan acceso como _Profesor_ pueden editarla libremente y utilizarla como espacio de práctica; quienes tengan acceso como _Estudiante_ pueden interactuar con ella del mismo modo que lo harían en una asignatura real.

El manual se organiza en las siguientes secciones, accesibles también desde la barra de fácil acceso de la asignatura:

1. Acceso a la plataforma
2. Áreas de la plataforma
3. Administración de la organización
4. Gestión de asignaturas
5. Edición del contenido
6. Archivos
7. Tareas
8. Notificaciones
9. Uso en teléfonos y sin conexión
10. Registro de actividad
11. Preguntas frecuentes y solución de problemas
12. Guía de alojamiento local para administradores

## Roles

La plataforma distingue dos niveles de permisos: el rol que una persona tiene en la organización y el rol que tiene en cada asignatura.

En la organización:

- **Administrador**: gestiona a los integrantes de la organización, edita sus datos y puede crear asignaturas y administrar la de cualquier docente.
- **Profesor**: puede crear asignaturas, en las que queda registrado como docente.
- **Alumno** (o _Estudiante_): participa en las asignaturas a las que es agregado.

En cada asignatura:

- **Profesor** (o _Docente_): edita el contenido, sube archivos, crea tareas, revisa y califica entregas, y administra a los integrantes.
- **Alumno** (o _Estudiante_): consulta el contenido y los archivos, y envía entregas en las tareas.

Una misma persona puede tener roles distintos en distintas asignaturas y pertenecer a más de una organización.

## Acceso a la plataforma

### Registro de una institución

El registro desde la pantalla de inicio crea simultáneamente una organización nueva y su primera cuenta de _Administrador_. Para ello se solicita:

- Nombre de usuario.
- Correo electrónico, que identifica la cuenta y no puede modificarse posteriormente.
- Contraseña y su confirmación.
- Nombre de la nueva organización.

Cada correo puede estar asociado a una sola cuenta. Al completar el registro, la plataforma crea automáticamente esta asignatura de introducción dentro de la nueva organización.

Los demás integrantes no deben registrarse por su cuenta: un administrador los agrega a la organización, tal como se describe en la sección _Administración de la organización_. Registrarse nuevamente crearía una organización distinta.

### Inicio de sesión

El inicio de sesión se realiza con el correo y la contraseña de la cuenta. Es posible avanzar entre los campos con la tecla Tabulador y enviar el formulario con la tecla Enter.

La sesión permanece abierta durante siete días por defecto, salvo que se cierre manualmente desde el botón de usuario. Al cambiar la contraseña, se cierran las sesiones abiertas en otros dispositivos.

### Activación de una cuenta mediante invitación

Cuando un administrador crea una cuenta sin asignarle una contraseña inicial, la plataforma envía al correo del nuevo usuario un enlace de invitación. Este enlace:

- Es personal y no debe compartirse.
- Tiene una vigencia de **72 horas** desde su envío.
- Permite definir la contraseña de la cuenta, que debe tener al menos 8 caracteres.

Una vez definida la contraseña, el enlace deja de ser válido y el usuario puede iniciar sesión normalmente. Si el enlace venció antes de usarse, se debe contactar al administrador de la organización.

## Áreas de la plataforma

### Hogar

Al iniciar sesión, la plataforma dirige al área <u>Hogar</u>, que ofrece un acceso rápido a las asignaturas consultadas más recientemente.

<img height="629" width="1218" alt="1" src="plantilla:1.png" />

Además, algunos elementos permanecen visibles en todas las áreas:

- La barra lateral, que permite navegar entre las distintas áreas.
- La barra superior, que contiene:
  - El botón de notificaciones, que informa sobre los cambios relevantes en la plataforma.
  - El botón de usuario, que muestra el nombre y correo de la cuenta, y da acceso a la configuración y al cierre de sesión.
  - El botón para alternar entre el modo claro y el modo oscuro.

### Asignaturas

En esta plataforma, una asignatura es un aula compartida entre docentes y estudiantes, que almacena contenido, recursos y tareas según las necesidades de cada docente. Actualmente se encuentra dentro de la asignatura **_Introducción al aula digital_**; el área <u>Asignaturas</u>, disponible en la barra lateral, permite crear y acceder a otras.

Cada asignatura puede compartirse con usuarios de la misma organización, ya sea como _Profesor_ o como _Estudiante_. Todos sus integrantes acceden a la misma información y a los mismos recursos, actualizados en tiempo real. La lista del área <u>Asignaturas</u> indica el nivel de acceso del usuario en cada una, y puede filtrarse por estado (activas o inactivas), ordenarse por nombre o por fecha, y restringirse a las asignaturas en que el usuario es docente.

<img height="575" width="1218" alt="2" src="plantilla:2.png" />

<img height="410" width="1218" alt="3" src="plantilla:3.png" />

### Archivos

El área <u>Archivos</u> reúne los archivos compartidos en las asignaturas del usuario, organizados en una carpeta por asignatura. Solo los usuarios con acceso de _Profesor_ en una asignatura pueden añadir o modificar archivos en su carpeta. El uso detallado se describe en la sección _Archivos_.

<img height="775" width="1218" alt="4" src="plantilla:4.png" />

### Organización

Todo usuario pertenece al menos a una organización, la cual se crea junto con una cuenta de _Administrador_. El área <u>Organización</u> muestra los datos de la organización activa, su lista de integrantes y las demás organizaciones a las que pertenece el usuario.

Por motivos de seguridad, solo un administrador puede agregar usuarios a la organización. Asimismo, por motivos de privacidad, no es posible agregar a una asignatura a usuarios externos a la organización.

<img height="539" width="1218" alt="5" src="plantilla:5.png" />

### Configuración

El área <u>Configuración</u> permite:

- Editar el nombre del perfil. El correo se muestra como referencia y no puede modificarse.
- Cambiar la contraseña, para lo cual se solicita la contraseña actual. La nueva contraseña debe tener al menos 8 caracteres.
- Elegir qué avisos se reciben también por correo electrónico (ver la sección _Notificaciones_).

<img alt="6" src="plantilla:7.png" />

## Administración de la organización

Las acciones de esta sección están disponibles únicamente para usuarios con rol de _Administrador_ en la organización activa.

### Agregar usuarios

El botón **Agregar usuarios** del área <u>Organización</u> abre un formulario con dos pestañas:

- **Crear usuario**: crea una cuenta nueva a partir del nombre, el correo y el rol. La contraseña inicial es opcional: si se omite, el usuario recibe por correo un enlace de invitación para definirla (ver _Activación de una cuenta mediante invitación_). Si se indica, debe tener al menos 8 caracteres y debe comunicarse al usuario por un medio seguro.
- **Usuario existente**: agrega a una persona que ya tiene una cuenta en la plataforma, por ejemplo porque pertenece a otra organización. Basta con indicar su correo y su rol; el usuario recibe una notificación.

Es posible añadir varios usuarios a la lista de pendientes y guardarlos en una sola operación. Los roles disponibles son _Administrador_, _Profesor_ y _Alumno_; un administrador también cuenta con los permisos de profesor.

### Quitar integrantes

La lista de integrantes, que se despliega con el botón **Mostrar usuarios**, muestra la última conexión de cada usuario y permite quitarlo de la organización previa confirmación. Al quitar a un integrante:

- Deja de tener acceso a la organización y a sus asignaturas. Sus entregas se conservan.
- Las asignaturas en que era el único docente se transfieren al administrador que realizó la acción.
- Si no pertenece a ninguna otra organización, su cuenta queda desactivada. La cuenta se reactiva si un administrador vuelve a agregarla con la opción **Usuario existente**.

La plataforma impide quitar al único administrador de una organización. Un administrador puede retirarse a sí mismo solo si existe otro administrador.

### Editar los datos de la organización

El botón **Editar** del área <u>Organización</u> permite modificar el nombre de la organización, que es obligatorio, y añadir una descripción, una dirección y la información de contacto. Estos datos son visibles para todos los integrantes.

### Imagen de portada

La organización y cada asignatura pueden tener una imagen de portada. Para cambiarla, se utiliza el botón **Cambiar imagen** ubicado sobre la portada, que permite seleccionar una imagen previamente subida a los archivos de la organización o de la asignatura, según corresponda. En la organización, esta acción está reservada a los administradores; en una asignatura, a sus docentes.

### Cambiar la organización activa

Un usuario que pertenece a varias organizaciones trabaja siempre sobre una organización activa, cuyas asignaturas y archivos se muestran en las demás áreas. Para cambiarla, basta con seleccionar otra organización en la sección **Cambia a otra organización** del área <u>Organización</u>.

## Gestión de asignaturas

### Crear una asignatura

Los usuarios con rol de _Profesor_ o _Administrador_ en la organización pueden crear asignaturas desde el área <u>Asignaturas</u>. El nombre es obligatorio y admite hasta 120 caracteres. Quien crea la asignatura queda registrado como su primer docente.

### Integrantes

El botón de integrantes, en la barra de fácil acceso de la asignatura, muestra la lista de participantes con su rol y su último acceso. Desde allí, los docentes de la asignatura y los administradores de la organización pueden:

- **Agregar usuarios**: se indica el correo de un usuario de la organización y su rol en la asignatura (_Profesor_ o _Alumno_). Solo pueden agregarse personas que ya pertenezcan a la organización.
- **Quitar usuarios**: previa confirmación. Las entregas del usuario se conservan.

Cualquier integrante puede retirarse de una asignatura con la opción **Salir**, con una excepción: una asignatura nunca puede quedar sin docentes, por lo que su único docente debe agregar a otro antes de retirarse.

Un administrador que no participa en una asignatura puede gestionar sus integrantes y su configuración, pero no ve su contenido ni sus entregas. Para acceder a ellos debe usar la opción **Unirme como docente**, acción que queda registrada en la lista de integrantes.

### Configuración de la asignatura

El botón **Configuración**, disponible para los docentes y los administradores, permite cambiar el nombre de la asignatura y su estado.

### Archivar y reactivar una asignatura

Al desactivar la opción **Asignatura activa**, la asignatura queda archivada en modo de solo lectura:

- Sus integrantes pueden seguir consultando el contenido, los archivos y las tareas.
- No es posible editar el contenido, subir, renombrar ni eliminar archivos, crear o modificar tareas, ni enviar o retirar entregas.
- Los docentes conservan la posibilidad de revisar y calificar las entregas ya recibidas.
- No se envían recordatorios de tareas por cerrar.

Para reactivarla, un docente o administrador vuelve a activar la opción en la misma página. Las asignaturas archivadas se pueden ubicar en el área <u>Asignaturas</u> con el filtro **Solo inactivas**.

## Edición del contenido

Al seleccionar una asignatura se muestra su contenido, junto con una barra de fácil acceso que permite administrar a sus integrantes, abrir la carpeta de recursos y acceder a la configuración.

El contenido se presenta en formato de documento y puede ser editado por los usuarios con acceso de _Profesor_. El botón **Editar** cambia la vista al modo de edición, en el que la barra de herramientas del editor permite añadir distintos componentes. Los cambios se aplican al presionar **Guardar cambios**, o se descartan con **Cancelar**.

<img height="383" width="1218" alt="7" src="plantilla:6.png" />

### Formato de texto

Es posible aplicar al texto los formatos **negrita**, _cursiva_ y <u>subrayado</u>, o una combinación de ellos. El menú desplegable permite cambiar el tamaño y la presentación del texto. Los textos con formato de encabezado se añaden automáticamente a la barra de fácil acceso como vínculos rápidos.

> Este es un ejemplo de un texto con formato de cita.

### Listas

Es posible agregar listas con viñetas, numeradas o de tareas.

- Este es un ejemplo de
- una lista con viñetas.
  - La tecla Tabulador añade un nivel de sangría.

1. Este es un ejemplo de
2. una lista numerada.

- [ ] Esta es una lista de tareas.
- [x] Cada elemento puede marcarse como completado.

### Enlaces o hipervínculos

El botón **Crear enlace** permite añadir hipervínculos a otras páginas web. [Este enlace](https://ubiobio.cl/w/ "Universidad del Bío-Bío") permite comprobar su funcionamiento.

### Imágenes

El botón **Insertar imagen de recursos** permite incrustar en la asignatura una imagen almacenada en sus archivos, seleccionándola mediante el administrador de archivos. Se admiten diversos formatos de imagen, incluidos GIF y WebP para imágenes animadas, como la siguiente:

![cat-fire-3989839543](plantilla:cat-fire-3989839543.gif)

### Descarga de recursos

El botón **Adjuntar recurso descargable** permite añadir un enlace de descarga a cualquier archivo de la asignatura. Por ejemplo: [cat-fire-3989839543.gif](plantilla:cat-fire-3989839543.gif)

### Enlaces a tareas

El botón **Crear tarea** de la barra de herramientas crea una tarea nueva e inserta un enlace a ella en el contenido. La tarea se crea al confirmar su formulario, aunque luego no se guarden los cambios del contenido; en ese caso, sigue disponible en la lista de tareas de la asignatura. El funcionamiento de las tareas se detalla en la sección _Tareas_.

## Archivos

Los archivos de una asignatura pueden gestionarse desde el área <u>Archivos</u> o desde la carpeta de recursos de la propia asignatura. Todos sus integrantes pueden consultarlos y descargarlos, mientras que solo sus docentes pueden modificarlos.

### Subir archivos

1. Abrir la carpeta de la asignatura.
2. Presionar **Subir** y seleccionar uno o más archivos, o arrastrarlos a la zona indicada.
3. Esperar a que finalice la carga de cada archivo.

Se aplican las siguientes restricciones:

- Cada archivo puede pesar como máximo **10 MB**.
- Dentro de una misma carpeta no pueden existir dos archivos con el mismo nombre. Si ya existe uno, se debe renombrar o eliminar antes de subir el nuevo.
- El nombre del archivo no puede superar los 255 caracteres ni contener barras (`/` o `\`).

Los archivos se almacenan cifrados en el servidor.

### Descargar, renombrar y eliminar

Al seleccionar uno o más archivos, la barra superior del administrador de archivos muestra las acciones disponibles:

- **Descargar**: guarda una copia del archivo en el dispositivo. También es posible abrir una vista previa de imágenes y documentos compatibles.
- **Renombrar**: cambia el nombre del archivo, respetando las mismas reglas de nombres que al subirlo. Las imágenes y enlaces del contenido que usan el archivo siguen funcionando.
- **Eliminar**: borra definitivamente los archivos seleccionados, previa confirmación. Las imágenes o enlaces del contenido que apuntaban a ellos dejarán de mostrarse.

La organización cuenta además con su propia carpeta de archivos generales, por ejemplo para su imagen de portada, que solo pueden modificar los administradores.

## Tareas

Una tarea es un espacio de interacción entre docentes y estudiantes, en el que el docente define un periodo para recibir respuestas a una actividad y cada estudiante envía sus archivos como respuesta.

Las entregas son individuales: cada estudiante ve únicamente la suya, y solo los docentes de la asignatura pueden ver las de todos. Las tareas pueden crearse y abrirse tanto desde el modo de edición como desde la barra de fácil acceso de la asignatura.

A continuación se incluye una tarea de ejemplo:

[Tarea de ejemplo](plantilla-tarea:ejemplo)

### Estados de una tarea

Según la hora del servidor, una tarea se encuentra en uno de tres estados:

- **Pendiente**: antes de la fecha de apertura. Los estudiantes pueden leer sus instrucciones, pero aún no pueden entregar.
- **Abierta**: desde la apertura hasta el límite de entrega, ambos incluidos.
- **Cerrada**: una vez pasado el límite de entrega. Ya no es posible enviar, retirar ni modificar entregas.

### Para docentes: crear una tarea

1. Presionar **+ Nueva** junto a la lista de tareas de la barra de fácil acceso, o usar el botón **Crear tarea** del editor.
2. Completar el **Título** (obligatorio, hasta 200 caracteres) y las **Instrucciones** (opcionales, con formato de texto).
3. Definir la **Apertura** y el **Límite de entrega**. La apertura debe ser anterior al límite.
4. Presionar **Crear tarea**.

Los estudiantes de la asignatura reciben una notificación de la nueva tarea. Una tarea puede editarse posteriormente con el botón **Editar**; eliminarla borra también todas sus entregas y archivos asociados.

### Para docentes: revisar y calificar

El botón **Revisar entregas** de cada tarea abre la página de revisión, donde los estudiantes pueden filtrarse en tres grupos: **Entregadas**, **Sin entrega** y **Sin calificar**. Para cada entrega es posible:

- Descargar los archivos enviados.
- Registrar una **Calificación** numérica.
- Escribir un comentario para el estudiante, de hasta 2000 caracteres.
- Guardar la revisión con el botón **Guardar**, tras lo cual el estudiante recibe un aviso.

Una entrega puede calificarse en cualquier momento después de enviada, incluso después del cierre de la tarea o si la asignatura fue archivada.

### Para estudiantes: enviar una entrega

1. Abrir la tarea mientras está abierta.
2. Presionar **Subir archivos** y seleccionar uno o más archivos (10 MB como máximo cada uno). Mientras no se envíen, los archivos quedan como borrador, visible solo para el estudiante, y pueden quitarse con **Quitar**.
3. Presionar **Enviar entrega**. Se requiere al menos un archivo.

### Para estudiantes: retirar y volver a entregar

Una entrega enviada no puede modificarse directamente. Mientras la tarea siga abierta, el botón **Retirar entrega** la devuelve al estado de borrador, lo que permite cambiar sus archivos y enviarla nuevamente. Al retirar una entrega, se descarta la calificación y el comentario que tuviera.

### Para estudiantes: consultar la calificación

Cuando un docente revisa la entrega, el estudiante recibe una notificación y la calificación y el comentario se muestran en la sección **Tu entrega** de la tarea. Por privacidad, la calificación nunca se incluye en los correos electrónicos.

## Notificaciones

El botón de notificaciones de la barra superior muestra un indicador con la cantidad de avisos sin leer. Al abrirlo, cada aviso conduce directamente al elemento correspondiente.

### Tipos de aviso

- **Nueva tarea**: un docente publicó una tarea en una de las asignaturas del usuario.
- **Tarea por cerrar**: el límite de entrega de una tarea vence en las próximas 24 horas y el estudiante aún no la ha enviado. Se envía una sola vez por tarea.
- **Entrega revisada**: un docente calificó o comentó la entrega del estudiante.
- **Nueva entrega**: un estudiante envió una tarea. Lo reciben los docentes; las entregas sucesivas de una misma tarea se agrupan en un solo aviso mientras no se lea.
- **Agregado a una asignatura**: el usuario fue incorporado a una asignatura.
- **Agregado a una organización**: el usuario fue incorporado a una organización.

### Avisos por correo electrónico

Todos los avisos aparecen siempre en la plataforma. Además, la sección **Avisos por correo** del área <u>Configuración</u> permite elegir cuáles se reciben también por correo electrónico; por defecto, todos están activos. El aviso de nueva entrega es la única excepción: se muestra solo en la plataforma, para no saturar el correo de los docentes.

### Dejar de recibir un tipo de aviso

Cada correo incluye al final el enlace **Dejar de recibir este tipo de aviso**, que desactiva ese tipo de correo sin necesidad de iniciar sesión. Puede volver a activarse en cualquier momento desde <u>Configuración</u>. El correo de invitación no incluye esta opción, ya que no corresponde a un aviso recurrente.

## Uso en teléfonos y sin conexión

### Teléfonos y pantallas pequeñas

La plataforma se adapta a pantallas de teléfono a partir de 320 píxeles de ancho:

- La barra lateral se oculta y se abre con el botón de menú de la barra superior.
- Las listas de integrantes y de asignaturas se presentan como tarjetas, con íconos que resumen el estado y el rol.
- Los formularios se muestran a pantalla completa.
- En pantallas de poca altura, los botones de la asignatura se muestran como botones flotantes.

Se recomienda crear un acceso rápido en la pantalla de inicio de dispositivos móviles, mediante la opción _Agregar a pantalla de inicio_ o _Instalar aplicación_ en el navegador web.

### Funcionamiento sin conexión

La plataforma conserva en el dispositivo una copia de la aplicación y de la información consultada recientemente, lo que permite seguir utilizándola ante una conexión inestable o inexistente. Sin conexión:

- **Sí es posible** abrir la plataforma y consultar las asignaturas, tareas, notificaciones y listas de archivos que ya se habían abierto con conexión, así como los archivos ya descargados o visualizados.
- **No es posible** guardar cambios: editar contenido, subir o eliminar archivos, enviar o retirar entregas ni calificar. Estas acciones no quedan en espera y deben repetirse cuando vuelva la conexión.

Mientras no hay conexión, se muestra el aviso **Sin conexión** en la parte superior de la pantalla. Con conexiones lentas, si el servidor no responde en pocos segundos, la plataforma muestra la última copia guardada.

La copia local se conserva por un máximo de 30 días y se elimina al cerrar sesión, por lo que en equipos compartidos se recomienda cerrar sesión al terminar. Cuando se publica una nueva versión de la plataforma, aparece el aviso **Hay una nueva versión de la plataforma** con el botón **Actualizar**.

## Registro de actividad

La plataforma mantiene un registro interno de las acciones realizadas en cada asignatura y organización, con el fin de dar trazabilidad a los cambios. Se registran, entre otras, las siguientes acciones:

- Creación, configuración y edición del contenido de una asignatura.
- Cambios en la imagen de portada.
- Subida, renombre y eliminación de archivos.
- Incorporación y retiro de integrantes.
- Edición de los datos de la organización.
- Creación, edición y eliminación de tareas.
- Envío, retiro y calificación de entregas.

Cada entrada indica quién realizó la acción y cuándo. Las ediciones sucesivas del contenido o de una tarea realizadas por una misma persona en un lapso de diez minutos se agrupan en una sola entrada. El registro de una asignatura es visible para sus docentes y para los administradores de la organización; el de la organización, solo para sus administradores.

## Preguntas frecuentes y solución de problemas

### «Esta cuenta ha sido desactivada»

Una cuenta se desactiva cuando su titular deja de pertenecer a cualquier organización. Para reactivarla, un administrador de la organización debe agregarla nuevamente con la opción **Usuario existente**. Como alternativa, es posible registrar una nueva organización con un correo distinto.

### «El plazo de entrega terminó»

Una vez pasado el límite de entrega, la tarea se cierra y no admite nuevos envíos ni retiros. Si existe un motivo justificado, el docente puede editar la tarea y extender su límite de entrega, con lo que vuelve a quedar abierta para todos los estudiantes.

### «La tarea aún no está abierta para entregas»

La tarea se encuentra en estado pendiente. Podrá enviarse a partir de la fecha de apertura indicada en ella.

### «Ya enviaste esta tarea»

Una entrega enviada no puede modificarse directamente. Si la tarea sigue abierta, se debe usar **Retirar entrega**, corregir los archivos y volver a enviarla.

### «La asignatura está inactiva y es de solo lectura»

La asignatura fue archivada. Un docente o administrador puede reactivarla desde su configuración (ver _Archivar y reactivar una asignatura_).

### «El archivo supera el tamaño máximo de 10 MB»

El archivo debe reducirse antes de subirlo, por ejemplo comprimiéndolo, reduciendo la resolución de imágenes o dividiendo documentos extensos en varias partes.

### «Ya existe un archivo con ese nombre»

La carpeta ya contiene un archivo con el mismo nombre. Se debe renombrar el archivo nuevo antes de subirlo, o renombrar o eliminar el existente.

### «El enlace no es válido o ya venció»

El enlace de invitación tiene una vigencia de 72 horas y solo puede usarse una vez. Si venció o ya fue utilizado, se debe contactar al administrador de la organización.

### No es posible agregar a un usuario a una asignatura

Solo pueden agregarse a una asignatura usuarios que ya pertenezcan a la organización. Si la persona no forma parte de ella, un administrador debe agregarla primero desde el área <u>Organización</u>.

### Los cambios no se guardan

Se debe verificar si aparece el aviso **Sin conexión**. Sin conexión es posible consultar información, pero no guardar cambios.

### No aparecen asignaturas inactivas en la lista

Se debe revisar el filtro de estado del área <u>Asignaturas</u> y seleccionar **Todos los estados** o **Solo inactivas**.

## Guía de alojamiento local para administradores

Esta sección está dirigida al personal técnico que desee alojar la plataforma en un servidor propio dentro de la institución, por ejemplo para operar en una red local con acceso limitado a Internet.

### Componentes

- **Frontend**: la aplicación web, servida por nginx en el puerto 8065, que además redirige las solicitudes `/api` al backend.
- **Backend**: el servidor Node.js con la API, en el puerto 8064.
- **Base de datos**: una instancia de MongoDB, local o externa.

### Requisitos

- Un equipo con Docker y Docker Compose instalados.
- Una copia del código fuente de la plataforma.
- Opcionalmente, una cuenta de correo con acceso SMTP para el envío de invitaciones y avisos.

### Configuración

1. Copiar el archivo `backend/.env.example` como `backend/.env`.
2. Definir `ENCRYPTION_KEY`, la clave con que se cifran los archivos almacenados: 32 bytes en formato hexadecimal o base64. Puede generarse con `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Esta clave debe respaldarse en un lugar seguro: si se pierde, los archivos almacenados no podrán recuperarse.
3. Definir `APP_URL` con la dirección en que los usuarios accederán a la plataforma, que se utiliza en los enlaces de los correos, y opcionalmente `APP_NOMBRE`.
4. Para el envío de correos, completar las variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `CORREO_REMITENTE`. Si se omiten, los correos solo se muestran en el registro del servidor.
5. Para usar una base de datos externa, definir `MONGODB_URI` y `MONGODB_DB`. Con la base de datos local incluida, estos valores se asignan automáticamente.

### Puesta en marcha

Con la base de datos local incluida, se ejecuta desde la carpeta raíz del proyecto:

`docker compose -f compose.yaml -f compose.local.yaml up -d --build`

Con una base de datos externa, basta con:

`docker compose up -d --build`

La plataforma queda disponible en el puerto 8065 del servidor, por ejemplo en `http://<dirección-del-servidor>:8065`. El primer administrador se crea mediante el registro de una institución, descrito en _Acceso a la plataforma_.

### Consideraciones

- El funcionamiento sin conexión requiere que la plataforma se sirva mediante HTTPS, salvo cuando se accede desde el mismo equipo (`localhost`). En una red local se recomienda disponer un proxy inverso con certificado.
- Los datos de la base de datos local se conservan en el volumen de Docker `mongo_data`, que debe incluirse en los respaldos periódicos.
- Para actualizar la plataforma, se obtiene la nueva versión del código y se vuelve a ejecutar el comando de puesta en marcha. Los usuarios verán el aviso de nueva versión al ingresar.
- Cambiar `TOKEN_SECRETO` o `ENCRYPTION_KEY`, cuando la primera no está definida, cierra todas las sesiones abiertas.

## Cierre

Con esto concluye la Introducción al aula digital. Como siguiente paso, se recomienda crear una nueva asignatura para organizar el trabajo de cada curso.
