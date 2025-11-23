// Esquema para la base de datos vectorial
// Base de datos: asistente_ia_vectorial
// Funcionalidad: Documentación, ejemplos y contexto para IA

-- Extensiones necesarias para PostgreSQL
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla principal de documentos vectoriales
CREATE TABLE documentos_vectoriales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo VARCHAR(500) NOT NULL,
    contenido TEXT NOT NULL,
    resumen TEXT,
    
    -- Vector embedding para búsqueda semántica
    embedding VECTOR(1536), -- OpenAI ada-002 tiene 1536 dimensiones
    
    -- Clasificación del documento
    tipo_documento VARCHAR(50) NOT NULL, -- 'actividad', 'ejemplo', 'guia', 'template'
    categoria VARCHAR(100),
    subcategoria VARCHAR(100),
    tags TEXT[], -- Array de tags
    
    -- Información de edad y contexto
    edad_minima INTEGER,
    edad_maxima INTEGER,
    tipo_actividad VARCHAR(50),
    dificultad VARCHAR(20),
    
    -- Metadatos
    fuente VARCHAR(200), -- URL, libro, autor, etc.
    autor VARCHAR(100),
    fecha_publicacion DATE,
    idioma VARCHAR(10) DEFAULT 'es',
    
    -- Control de calidad
    verificado BOOLEAN DEFAULT FALSE,
    calificacion FLOAT, -- 1-5 estrellas
    numero_usos INTEGER DEFAULT 0,
    
    -- Campos de auditoría
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla de ejemplos de actividades exitosas
CREATE TABLE ejemplos_actividades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    documento_id UUID REFERENCES documentos_vectoriales(id) ON DELETE CASCADE,
    
    -- Datos específicos de la actividad
    titulo_actividad VARCHAR(300) NOT NULL,
    objetivo_principal TEXT,
    materiales_necesarios TEXT[],
    preparacion_previa TEXT,
    desarrollo_actividad TEXT NOT NULL,
    variaciones TEXT,
    consejos_monitores TEXT,
    
    -- Información contextual
    lugar VARCHAR(100), -- interior, exterior, ambos
    epoca_año VARCHAR(50), -- 'todo el año', 'verano', 'navidad'
    grupo_tamaño VARCHAR(50), -- 'pequeño', 'mediano', 'grande'
    
    -- Métricas de éxito
    efectividad_reportada FLOAT,
    feedback_participantes TEXT,
    adaptaciones_realizadas TEXT,
    
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de plantillas y estructuras
CREATE TABLE plantillas_actividades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    estructura JSONB NOT NULL, -- Estructura de la plantilla en JSON
    
    -- Clasificación
    tipo_plantilla VARCHAR(50), -- 'dinamica', 'juego', 'reflexion', etc.
    complejidad VARCHAR(20),
    tiempo_estimado INTEGER, -- en minutos
    
    -- Variables de la plantilla
    variables_requeridas TEXT[], -- Variables que debe llenar el usuario
    variables_opcionales TEXT[],
    
    -- Uso y popularidad
    veces_usada INTEGER DEFAULT 0,
    rating_promedio FLOAT,
    
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla de frases y contenido inspiracional
CREATE TABLE contenido_inspiracional (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(50) NOT NULL, -- 'frase', 'oracion', 'reflexion', 'cita'
    contenido TEXT NOT NULL,
    autor VARCHAR(100),
    fuente VARCHAR(200),
    
    -- Contexto de uso
    tematica VARCHAR(100), -- 'amistad', 'valores', 'fe', 'superacion'
    momento_uso VARCHAR(100), -- 'inicio', 'cierre', 'reflexion', 'dinamica'
    edad_apropiada VARCHAR(50),
    
    embedding VECTOR(1536),
    
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla de conocimiento específico sobre juventud
CREATE TABLE conocimiento_juventud (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tema VARCHAR(200) NOT NULL,
    contenido TEXT NOT NULL,
    
    -- Clasificación por edad
    rango_edad VARCHAR(50), -- '12-14', '15-17', '18-21', etc.
    
    -- Tipo de conocimiento
    tipo VARCHAR(50), -- 'psicologia', 'desarrollo', 'intereses', 'problemas_comunes'
    
    -- Aplicabilidad
    aplicacion_actividades TEXT,
    consejos_monitores TEXT,
    
    embedding VECTOR(1536),
    
    -- Referencias
    fuentes TEXT[],
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verificado BOOLEAN DEFAULT FALSE
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_documentos_embedding ON documentos_vectoriales USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_documentos_tipo ON documentos_vectoriales(tipo_documento);
CREATE INDEX idx_documentos_categoria ON documentos_vectoriales(categoria);
CREATE INDEX idx_documentos_edad ON documentos_vectoriales(edad_minima, edad_maxima);
CREATE INDEX idx_documentos_tags ON documentos_vectoriales USING GIN (tags);

CREATE INDEX idx_ejemplos_tipo ON ejemplos_actividades(lugar);
CREATE INDEX idx_plantillas_tipo ON plantillas_actividades(tipo_plantilla);
CREATE INDEX idx_contenido_tematica ON contenido_inspiracional(tematica);
CREATE INDEX idx_conocimiento_edad ON conocimiento_juventud(rango_edad);

-- Función para búsqueda semántica
CREATE OR REPLACE FUNCTION buscar_documentos_similares(
    query_embedding VECTOR(1536),
    limite INTEGER DEFAULT 10,
    umbral_similitud FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    titulo VARCHAR,
    contenido TEXT,
    similitud FLOAT,
    tipo_documento VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.titulo,
        d.contenido,
        1 - (d.embedding <=> query_embedding) AS similitud,
        d.tipo_documento
    FROM documentos_vectoriales d
    WHERE d.activo = TRUE
      AND 1 - (d.embedding <=> query_embedding) > umbral_similitud
    ORDER BY d.embedding <=> query_embedding
    LIMIT limite;
END;
$$ LANGUAGE plpgsql;