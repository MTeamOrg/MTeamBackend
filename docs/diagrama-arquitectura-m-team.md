# Diagrama de Arquitectura — M-Team

```mermaid
flowchart LR
    U["Usuarios<br/>Socio · Entrenador · Administrador"]
    FE["Frontend web<br/>React + TypeScript"]
    BE["Backend<br/>Node.js + Express"]
    MAPS["API externa<br/>Google Maps"]
    MAIL["Gmail SMTP<br/>Recuperación de cuenta"]
    DB[("PostgreSQL<br/>Supabase")]
    STORAGE[("Supabase Storage<br/>Fotos y aptos")]

    U -->|"HTTPS"| FE
    FE -->|"REST / HTTPS"| BE
    FE -->|"HTTPS"| MAPS
    BE -->|"Prisma / SQL"| DB
    BE -->|"HTTPS"| STORAGE
    BE -->|"SMTP seguro"| MAIL
```

El frontend consume exclusivamente la API REST. El backend concentra autenticación, autorización, validación, idempotencia, notificaciones y acceso a Storage; PostgreSQL conserva el estado transaccional. Las fotos de perfil utilizan un bucket público separado de los aptos médicos, que requieren acceso privado/firmado. Google Maps y Gmail SMTP son dependencias externas: su configuración productiva debe comprobarse en el ambiente correspondiente.
