import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import { supabase } from '../SupabaseClient'

const GOLD = '#c9a84c'

interface PlanoDocument {
  id: string
  title: string
  content: string
  position: number
  updatedAt: string
}

const DOCUMENT_TITLES = [
  'BONO POR REGISTRO',
  'DEPOSITO Y RETIRO',
  'COMO ME REGISTRO',
  'MARKETING',
  'BONO POR PRIMERA RECARGA',
  'CUENTA AUTORIZADA PARA DEPOSITO',
  'BONOS POR DIAS',
  'CAMBIO DE CONTRASEÑA',
  'MENSAJES CORTOS',
  'DATOS DE ACCESO',
  'PENDIENTES',
  'NOVEDADES',
  'DIARIO',
  'PREGUNTAS FRECUENTES',
]

const createInitialDocuments = (): PlanoDocument[] =>
  DOCUMENT_TITLES.map((title, index) => ({
    id: `document-${index + 1}`,
    title,
    position: index,
    content: getInitialContent(title),
    updatedAt: new Date().toISOString(),
  }))

function getInitialContent(title: string): string {
  switch (title) {
    case 'BONO POR REGISTRO':
      return `
        <h1>BONO POR REGISTRO</h1>
        <p>El cliente nuevo registrado recibe <strong>100 giros gratis</strong>.</p>
        <p>Para activar el retiro debe realizar su primera recarga.</p>
        <p>El monto de la recarga debe ser igual o superior al valor ganado.</p>
        <p>Para retirar, debe cumplir la rotación correspondiente.</p>
      `

    case 'DEPOSITO Y RETIRO':
      return `
        <h1>DEPOSITO Y RETIRO</h1>
        <h2>Consideraciones generales</h2>
        <ul>
          <li>Verificar siempre el país del cliente.</li>
          <li>Confirmar el método de depósito disponible.</li>
          <li>Revisar las condiciones antes de procesar un retiro.</li>
          <li>Validar que el cliente haya cumplido los requisitos establecidos.</li>
        </ul>
      `

    case 'COMO ME REGISTRO':
      return `
        <h1>COMO ME REGISTRO</h1>
        <ol>
          <li>Ingresar a la plataforma.</li>
          <li>Seleccionar la opción de registro.</li>
          <li>Completar los datos solicitados.</li>
          <li>Confirmar el registro.</li>
          <li>Ingresar nuevamente con las credenciales creadas.</li>
        </ol>
        <p>Puedes agregar aquí imágenes explicativas del proceso.</p>
      `

    case 'MARKETING':
      return `
        <h1>MARKETING</h1>
        <p>Material e información utilizada para las publicaciones en redes sociales.</p>
        <p>Puedes insertar aquí imágenes, piezas publicitarias y material de referencia.</p>
      `

    case 'BONO POR PRIMERA RECARGA':
      return `
        <h1>BONO POR PRIMERA RECARGA</h1>
        <p>Agrega aquí las condiciones y procedimientos correspondientes al bono por primera recarga.</p>
      `

    case 'CUENTA AUTORIZADA PARA DEPOSITO':
      return `
        <h1>CUENTA AUTORIZADA PARA DEPOSITO</h1>
        <p><strong>Documento pendiente de completar.</strong></p>
        <p>Agrega aquí la información correspondiente desde el editor.</p>
      `

    case 'BONOS POR DIAS':
      return `
        <h1>BONOS POR DIAS</h1>

        <h2>Lunes — Salida de Campeones</h2>
        <ul>
          <li>50% → X5</li>
          <li>60% → X4</li>
          <li>80% → X3</li>
        </ul>

        <h2>Martes — De Multiplicar</h2>
        <p>Promociones especiales según el país y el tipo de recarga.</p>

        <h2>Miércoles — Salvaje</h2>
        <p>Promoción correspondiente al día miércoles.</p>

        <h2>Jueves y Viernes — 3×3</h2>
        <p>Promociones especiales con beneficios adicionales.</p>

        <h2>Sábado — Sábado de Galope</h2>
        <p>20% en hipismo con rollover X5.</p>

        <h2>Domingo</h2>
        <p>No hay promoción configurada.</p>
      `

    case 'CAMBIO DE CONTRASEÑA':
      return `
        <h1>CAMBIO DE CONTRASEÑA</h1>
        <p>Para solicitar un cambio de contraseña se deben verificar los datos del cliente.</p>
        <ul>
          <li>Nombre completo.</li>
          <li>Validación de identidad cuando corresponda.</li>
          <li>Confirmación de la solicitud.</li>
        </ul>
      `

    case 'MENSAJES CORTOS':
      return `
        <h1>MENSAJES CORTOS</h1>

        <h2>Mensaje de bienvenida</h2>
        <p>¡Hola! Bienvenido a Hípicas Babieca. Estamos para ayudarte.</p>

        <h2>Solicitud de espera</h2>
        <p>Un momento por favor mientras verificamos la información.</p>

        <h2>Verificación</h2>
        <p>Estamos validando tu solicitud. Te informaremos apenas tengamos una respuesta.</p>
      `

    case 'DATOS DE ACCESO':
      return `
        <h1>DATOS DE ACCESO</h1>
        <p><strong>Documento pendiente de completar.</strong></p>
        <p>Por seguridad, agrega las credenciales directamente desde el editor.</p>
      `

    case 'PENDIENTES':
      return `
        <h1>PENDIENTES</h1>
        <p>Registra aquí las tareas, verificaciones o situaciones que estén pendientes.</p>

        <ul>
          <li>Agregar pendiente...</li>
          <li>Agregar pendiente...</li>
        </ul>
      `

    case 'NOVEDADES':
      return `
        <h1>NOVEDADES</h1>
        <p>Utiliza este documento para registrar novedades importantes del equipo o de la operación.</p>
      `

    case 'DIARIO':
      return `
        <h1>DIARIO</h1>
        <p>Registro diario de información importante.</p>

        <h2>Fecha</h2>
        <p>Agrega aquí las novedades correspondientes al día.</p>
      `

    case 'PREGUNTAS FRECUENTES':
      return `
        <h1>PREGUNTAS FRECUENTES</h1>

        <h2>¿Qué es el rollover?</h2>
        <p>Es la cantidad de veces que debe rotarse el monto establecido para cumplir las condiciones del bono.</p>

        <h2>¿Cuándo se entrega un bono?</h2>
        <p>Depende de las condiciones de la promoción vigente y del cumplimiento de los requisitos.</p>

        <h2>¿Dónde puedo consultar las condiciones?</h2>
        <p>Consulta las promociones y condiciones registradas en este manual.</p>
      `

    default:
      return '<p>Comienza a escribir aquí...</p>'
  }
}

function ToolbarButton({
  active = false,
  onClick,
  children,
  title,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className="w-8 h-8 rounded-md flex items-center justify-center text-sm transition-all"
      style={{
        backgroundColor: active
          ? 'rgba(201,168,76,0.15)'
          : 'transparent',
        color: active ? GOLD : '#a1a1aa',
        border: active
          ? '1px solid rgba(201,168,76,0.25)'
          : '1px solid transparent',
      }}
    >
      {children}
    </button>
  )
}

export default function Plano() {
  const [documents, setDocuments] = useState<PlanoDocument[]>([])
  const [documentContents, setDocumentContents] = useState<
    Record<string, string>
  >({})
  const [selectedId, setSelectedId] = useState('')
  const [saved, setSaved] = useState(true)
  const [loading, setLoading] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  /*
   * CARGAR DOCUMENTOS DESDE SUPABASE
   */
  useEffect(() => {
    const loadDocuments = async () => {
      const { data, error } = await supabase
        .from('plano_documents')
        .select('id, title, position, updated_at')
        .order('position', {
          ascending: true,
        })

      if (error) {
        console.error(
          'Error cargando documentos del Plano:',
          error,
        )
        setLoading(false)
        return
      }

      /*
       * Si la tabla está vacía, creamos los
       * documentos iniciales automáticamente.
       */
      if (!data || data.length === 0) {
        const initialDocuments =
          createInitialDocuments()

        const rows = initialDocuments.map(
          document => ({
            id: document.id,
            title: document.title,
            content: document.content,
            position: document.position,
            updated_at: document.updatedAt,
          }),
        )

        const { error: insertError } =
          await supabase
            .from('plano_documents')
            .insert(rows)

        if (insertError) {
          console.error(
            'Error creando documentos iniciales:',
            insertError,
          )
          setLoading(false)
          return
        }

        setDocuments(initialDocuments)

        setDocumentContents(
          Object.fromEntries(
            initialDocuments.map(document => [
              document.id,
              document.content,
            ]),
          ),
        )

        setSelectedId(
          initialDocuments[0]?.id ?? '',
        )

        setLoading(false)
        return
      }

      /*
       * Solo cargamos los metadatos inicialmente.
       * El contenido se carga cuando se selecciona
       * cada documento.
       */
      const mappedDocuments: PlanoDocument[] =
        data.map(document => ({
          id: document.id,
          title: document.title,
          content: '',
          position: document.position,
          updatedAt: document.updated_at,
        }))

      setDocuments(mappedDocuments)
      setSelectedId(mappedDocuments[0]?.id ?? '')
      setLoading(false)
    }

    loadDocuments()
  }, [])

  useEffect(() => {
    if (!selectedId) return

    if (documentContents[selectedId] !== undefined) {
      return
    }

    const loadSelectedDocument = async () => {
      const { data, error } = await supabase
        .from('plano_documents')
        .select('content')
        .eq('id', selectedId)
        .single()

      if (error) {
        console.error(
          'Error cargando contenido del documento:',
          error,
        )
        return
      }

      setDocumentContents(current => ({
        ...current,
        [selectedId]: data.content,
      }))
    }

    loadSelectedDocument()
  }, [selectedId, documentContents])

  const selectedDocument = useMemo(() => {
    const document =
      documents.find(
        document => document.id === selectedId,
      ) ?? documents[0]

    if (!document) return undefined

    return {
      ...document,
      content:
        documentContents[document.id] ??
        '',
    }
  }, [documents, selectedId, documentContents])

  /*
   * EDITOR
   */
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
    ],

    content: selectedDocument?.content ?? '',

    immediatelyRender: false,

    onUpdate: ({ editor }) => {
      const content = editor.getHTML()
      const updatedAt = new Date().toISOString()

      setDocuments(current =>
        current.map(document =>
          document.id === selectedId
            ? {
              ...document,
              content,
              updatedAt,
            }
            : document,
        ),
      )

      setDocumentContents(current => ({
        ...current,
        [selectedId]: content,
      }))

      setSaved(false)
    },
  })

  /*
   * CAMBIAR DOCUMENTO
   */
  useEffect(() => {
    if (!editor || !selectedDocument) return

    editor.commands.setContent(
      selectedDocument.content,
      {
        emitUpdate: false,
      },
    )

    setSaved(true)
  }, [
    editor,
    selectedId,
    documentContents[selectedId],
  ])
  /*
   * AUTOSAVE EN SUPABASE
   *
   * Se espera 500 ms después del último cambio
   * antes de guardar.
   */
  useEffect(() => {
    if (loading || !selectedId) return

    const content = documentContents[selectedId]

    if (content === undefined) return

    const currentDocument = documents.find(
      document => document.id === selectedId,
    )

    if (!currentDocument) return

    const timeout = window.setTimeout(async () => {
      const updatedAt = new Date().toISOString()

      const { error } = await supabase
        .from('plano_documents')
        .update({
          title: currentDocument.title,
          content,
          position: currentDocument.position,
          updated_at: updatedAt,
        })
        .eq('id', selectedId)

      if (error) {
        console.error(
          'Error guardando documento:',
          error,
        )
        setSaved(false)
        return
      }

      setSaved(true)
    }, 500)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [
    documentContents,
    documents,
    selectedId,
    loading,
  ])

  /*
   * GUARDAR MANUALMENTE
   */
  const saveCurrentDocument = async () => {
    if (!selectedDocument) return

    setSaved(false)

    const { error } = await supabase
      .from('plano_documents')
      .update({
        title: selectedDocument.title,
        content: selectedDocument.content,
        position: selectedDocument.position,
        updated_at: selectedDocument.updatedAt,
      })
      .eq('id', selectedDocument.id)

    if (error) {
      console.error(
        'Error guardando documento:',
        error,
      )
      return
    }

    setSaved(true)
  }

  /*
   * CREAR DOCUMENTO
   */
  const createDocument = async () => {
    const title = window.prompt(
      'Nombre del nuevo documento:',
    )

    if (!title?.trim()) return

    const newDocument: PlanoDocument = {
      id: `document-${Date.now()}`,
      title: title.trim(),
      content:
        '<p>Escribe aquí el contenido del documento...</p>',
      position: documents.length,
      updatedAt: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('plano_documents')
      .insert({
        id: newDocument.id,
        title: newDocument.title,
        content: newDocument.content,
        position: newDocument.position,
        updated_at: newDocument.updatedAt,
      })

    if (error) {
      console.error(
        'Error creando documento:',
        error,
      )
      return
    }

    setDocuments(current => [
      ...current,
      newDocument,
    ])

    setSelectedId(newDocument.id)
    setSaved(true)
  }

  /*
   * RENOMBRAR DOCUMENTO
   */
  const renameDocument = async (
    documentId: string,
  ) => {
    const document = documents.find(
      doc => doc.id === documentId,
    )

    if (!document) return

    const newTitle = window.prompt(
      'Nuevo nombre del documento:',
      document.title,
    )

    if (!newTitle?.trim()) return

    const updatedDocument = {
      ...document,
      title: newTitle.trim(),
      updatedAt: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('plano_documents')
      .update({
        title: updatedDocument.title,
        updated_at: updatedDocument.updatedAt,
      })
      .eq('id', documentId)

    if (error) {
      console.error(
        'Error renombrando documento:',
        error,
      )
      return
    }

    setDocuments(current =>
      current.map(doc =>
        doc.id === documentId
          ? updatedDocument
          : doc,
      ),
    )

    setSaved(true)
  }

  /*
   * ELIMINAR DOCUMENTO
   */
  const deleteDocument = async (
    documentId: string,
  ) => {
    const document = documents.find(
      doc => doc.id === documentId,
    )

    if (!document) return

    const confirmed = window.confirm(
      `¿Seguro que quieres eliminar "${document.title}"?\n\nEsta acción no se puede deshacer.`,
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('plano_documents')
      .delete()
      .eq('id', documentId)

    if (error) {
      console.error(
        'Error eliminando documento:',
        error,
      )
      return
    }

    const updatedDocuments = documents
      .filter(doc => doc.id !== documentId)
      .map((doc, index) => ({
        ...doc,
        position: index,
      }))

    /*
     * Actualizamos las posiciones restantes
     * en Supabase.
     */
    for (const document of updatedDocuments) {
      await supabase
        .from('plano_documents')
        .update({
          position: document.position,
          updated_at: document.updatedAt,
        })
        .eq('id', document.id)
    }

    setDocuments(updatedDocuments)

    if (documentId === selectedId) {
      setSelectedId(
        updatedDocuments[0]?.id ?? '',
      )
    }

    setSaved(true)
  }

  /*
   * SELECCIONAR DOCUMENTO
   */
  const handleSelectDocument = (
    id: string,
  ) => {
    if (id === selectedId) return

    setSelectedId(id)
  }

  /*
   * INSERTAR IMAGEN
   */
  const handleImageUpload = (file: File) => {
    if (!editor) return

    if (!file.type.startsWith('image/')) {
      return
    }

    if (file.size > 3 * 1024 * 1024) {
      alert(
        'La imagen es demasiado grande. Máximo 3 MB.',
      )
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      if (
        typeof reader.result !== 'string'
      ) {
        return
      }

      editor
        .chain()
        .focus()
        .setImage({
          src: reader.result,
          alt: file.name,
        })
        .run()
    }

    reader.readAsDataURL(file)
  }

  if (loading) {
    return (
      <div className="p-6 max-w-[1500px] mx-auto">
        <div className="text-sm text-zinc-500">
          Cargando Plano...
        </div>
      </div>
    )
  }

  if (
    !editor ||
    !selectedDocument
  ) {
    return null
  }

  return (
    <div
      className="p-4 md:p-6 flex flex-col gap-4 max-w-[1500px] mx-auto"
      style={{
        minHeight: 'calc(100vh - 64px)',
        color: '#f4f4f5',
      }}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Plano
          </h1>

          <p className="text-sm text-zinc-500 mt-1">
            Manual interno y documentación operativa
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="text-xs"
            style={{
              color: saved
                ? '#71717a'
                : GOLD,
            }}
          >
            {saved
              ? 'Guardado ✓'
              : 'Guardando...'}
          </span>

          <button
            type="button"
            onClick={saveCurrentDocument}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: GOLD,
              color: '#09090b',
            }}
            onMouseEnter={e =>
            (e.currentTarget.style.backgroundColor =
              '#e4c97a')
            }
            onMouseLeave={e =>
            (e.currentTarget.style.backgroundColor =
              GOLD)
            }
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>

            Guardar
          </button>
        </div>
      </div>

      {/* MOBILE DOCUMENT SELECTOR */}
      <div className="lg:hidden flex items-center gap-2">
        <select
          value={selectedId}
          onChange={e =>
            handleSelectDocument(
              e.target.value,
            )
          }
          className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 outline-none"
        >
          {documents.map(document => (
            <option
              key={document.id}
              value={document.id}
            >
              {document.title}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={createDocument}
          title="Nuevo documento"
          className="flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-xl transition-all"
          style={{
            color: GOLD,
            backgroundColor:
              'rgba(201,168,76,0.08)',
            border:
              '1px solid rgba(201,168,76,0.25)',
          }}
          onMouseEnter={e =>
          (e.currentTarget.style.backgroundColor =
            'rgba(201,168,76,0.18)')
          }
          onMouseLeave={e =>
          (e.currentTarget.style.backgroundColor =
            'rgba(201,168,76,0.08)')
          }
        >
          +
        </button>
      </div>

      {/* MAIN */}
      <div
        className="flex-1 flex rounded-xl overflow-hidden border"
        style={{
          borderColor: '#27272a',
          backgroundColor: '#111113',
          minHeight: 600,
        }}
      >
        {/* SIDEBAR */}
        <aside
          className="hidden lg:flex w-72 flex-shrink-0 flex-col border-r"
          style={{
            borderColor: '#27272a',
            backgroundColor: '#0d0d0f',
          }}
        >
          <div className="px-4 py-4 border-b border-zinc-800 flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-500 tracking-wider">
              DOCUMENTOS
            </p>

            <button
              type="button"
              onClick={createDocument}
              title="Nuevo documento"
              className="w-7 h-7 rounded-md flex items-center justify-center text-lg transition-all"
              style={{
                color: GOLD,
                backgroundColor:
                  'rgba(201,168,76,0.08)',
              }}
              onMouseEnter={e =>
              (e.currentTarget.style.backgroundColor =
                'rgba(201,168,76,0.18)')
              }
              onMouseLeave={e =>
              (e.currentTarget.style.backgroundColor =
                'rgba(201,168,76,0.08)')
              }
            >
              +
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {documents.map(document => {
              const active =
                document.id === selectedId

              return (
                <div
                  key={document.id}
                  className="group flex items-center gap-1 rounded-lg mb-1"
                  style={{
                    backgroundColor: active
                      ? 'rgba(201,168,76,0.1)'
                      : 'transparent',
                    border: active
                      ? '1px solid rgba(201,168,76,0.18)'
                      : '1px solid transparent',
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectDocument(
                        document.id,
                      )
                    }
                    className="min-w-0 flex-1 text-left px-3 py-2.5 text-sm transition-all"
                    style={{
                      color: active
                        ? GOLD
                        : '#a1a1aa',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.color =
                          '#e4e4e7'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.color =
                          '#a1a1aa'
                      }
                    }}
                  >
                    <span className="block truncate">
                      {document.title}
                    </span>
                  </button>

                  <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      title="Renombrar"
                      onClick={() =>
                        renameDocument(
                          document.id,
                        )
                      }
                      className="w-7 h-7 rounded flex items-center justify-center text-xs text-zinc-500 hover:text-[#c9a84c] hover:bg-zinc-800 transition-all"
                    >
                      ✎
                    </button>

                    <button
                      type="button"
                      title="Eliminar"
                      onClick={() =>
                        deleteDocument(
                          document.id,
                        )
                      }
                      className="w-7 h-7 rounded flex items-center justify-center text-xs text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-all"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="p-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={createDocument}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                border:
                  '1px dashed rgba(201,168,76,0.4)',
                color: GOLD,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor =
                  'rgba(201,168,76,0.08)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor =
                  'transparent'
              }}
            >
              <span className="text-lg leading-none">
                +
              </span>
              Nuevo documento
            </button>
          </div>
        </aside>

        {/* EDITOR */}
        <section className="flex-1 min-w-0 flex flex-col">
          <div
            className="px-4 md:px-6 py-4 border-b flex items-center justify-between gap-3"
            style={{
              borderColor: '#27272a',
            }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs text-zinc-600 mb-1">
                DOCUMENTO
              </p>

              <h2 className="text-base md:text-lg font-semibold text-zinc-100 truncate">
                {selectedDocument.title}
              </h2>
            </div>

            <div className="lg:hidden flex items-center gap-1">
              <button
                type="button"
                title="Renombrar"
                onClick={() =>
                  renameDocument(
                    selectedDocument.id,
                  )
                }
                className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-[#c9a84c] hover:bg-zinc-800 transition-all"
              >
                ✎
              </button>

              <button
                type="button"
                title="Eliminar"
                onClick={() =>
                  deleteDocument(
                    selectedDocument.id,
                  )
                }
                className="w-8 h-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-all"
              >
                🗑
              </button>
            </div>
          </div>

          {/* TOOLBAR */}
          <div
            className="px-3 py-2 border-b flex items-center gap-1 flex-wrap"
            style={{
              borderColor: '#27272a',
              backgroundColor: '#0d0d0f',
            }}
          >
            <ToolbarButton
              title="Negrita"
              active={editor.isActive('bold')}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleBold()
                  .run()
              }
            >
              <strong>B</strong>
            </ToolbarButton>

            <ToolbarButton
              title="Cursiva"
              active={editor.isActive('italic')}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleItalic()
                  .run()
              }
            >
              <em>I</em>
            </ToolbarButton>

            <ToolbarButton
              title="Subrayado"
              active={editor.isActive('underline')}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleUnderline()
                  .run()
              }
            >
              <u>U</u>
            </ToolbarButton>

            <div className="w-px h-5 bg-zinc-800 mx-1" />

            <ToolbarButton
              title="Título 1"
              active={editor.isActive(
                'heading',
                { level: 1 },
              )}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleHeading({
                    level: 1,
                  })
                  .run()
              }
            >
              H1
            </ToolbarButton>

            <ToolbarButton
              title="Título 2"
              active={editor.isActive(
                'heading',
                { level: 2 },
              )}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleHeading({
                    level: 2,
                  })
                  .run()
              }
            >
              H2
            </ToolbarButton>

            <ToolbarButton
              title="Título 3"
              active={editor.isActive(
                'heading',
                { level: 3 },
              )}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleHeading({
                    level: 3,
                  })
                  .run()
              }
            >
              H3
            </ToolbarButton>

            <div className="w-px h-5 bg-zinc-800 mx-1" />

            <ToolbarButton
              title="Lista con viñetas"
              active={editor.isActive(
                'bulletList',
              )}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleBulletList()
                  .run()
              }
            >
              •☷
            </ToolbarButton>

            <ToolbarButton
              title="Lista numerada"
              active={editor.isActive(
                'orderedList',
              )}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleOrderedList()
                  .run()
              }
            >
              1.
            </ToolbarButton>

            <div className="w-px h-5 bg-zinc-800 mx-1" />

            <ToolbarButton
              title="Alinear izquierda"
              active={editor.isActive({
                textAlign: 'left',
              })}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .setTextAlign('left')
                  .run()
              }
            >
              ≡
            </ToolbarButton>

            <ToolbarButton
              title="Centrar"
              active={editor.isActive({
                textAlign: 'center',
              })}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .setTextAlign('center')
                  .run()
              }
            >
              ≡
            </ToolbarButton>

            <ToolbarButton
              title="Alinear derecha"
              active={editor.isActive({
                textAlign: 'right',
              })}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .setTextAlign('right')
                  .run()
              }
            >
              ≡
            </ToolbarButton>

            <div className="w-px h-5 bg-zinc-800 mx-1" />

            <ToolbarButton
              title="Separador"
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .setHorizontalRule()
                  .run()
              }
            >
              ―
            </ToolbarButton>

            <ToolbarButton
              title="Insertar imagen"
              onClick={() =>
                fileInputRef.current?.click()
              }
            >
              🖼
            </ToolbarButton>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file =
                  e.target.files?.[0]

                if (file) {
                  handleImageUpload(file)
                }

                e.target.value = ''
              }}
            />

            <div className="flex-1" />

            <ToolbarButton
              title="Deshacer"
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .undo()
                  .run()
              }
            >
              ↶
            </ToolbarButton>

            <ToolbarButton
              title="Rehacer"
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .redo()
                  .run()
              }
            >
              ↷
            </ToolbarButton>
          </div>

          {/* EDITABLE AREA */}
          <div className="flex-1 overflow-y-auto bg-zinc-950">
            <div className="max-w-4xl mx-auto px-5 md:px-12 py-8 md:py-10">
              <EditorContent
                editor={editor}
              />
            </div>
          </div>
        </section>
      </div>

      <style>{`
        .ProseMirror {
          min-height: 450px;
          outline: none;
          color: #d4d4d8;
          font-size: 15px;
          line-height: 1.75;
        }

        .ProseMirror p {
          margin: 0.65rem 0;
        }

        .ProseMirror h1 {
          color: #f4f4f5;
          font-size: 1.75rem;
          line-height: 1.25;
          font-weight: 700;
          margin: 0 0 1.5rem;
        }

        .ProseMirror h2 {
          color: #e4e4e7;
          font-size: 1.25rem;
          line-height: 1.35;
          font-weight: 650;
          margin: 1.8rem 0 0.75rem;
        }

        .ProseMirror h3 {
          color: #e4e4e7;
          font-size: 1.05rem;
          font-weight: 600;
          margin: 1.4rem 0 0.6rem;
        }

        .ProseMirror strong {
          color: #f4f4f5;
          font-weight: 700;
        }

        .ProseMirror em {
          color: #e4e4e7;
        }

        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5rem;
          margin: 0.75rem 0;
        }

        .ProseMirror li {
          margin: 0.3rem 0;
        }

        .ProseMirror hr {
          border: 0;
          border-top: 1px solid #3f3f46;
          margin: 1.5rem 0;
        }

        .ProseMirror img {
          display: block;
          max-width: 100%;
          height: auto;
          margin: 1.25rem auto;
          border-radius: 0.75rem;
        }

        .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid ${GOLD};
        }

        .ProseMirror a {
          color: ${GOLD};
        }

        .ProseMirror ::selection {
          background: rgba(201,168,76,0.25);
        }
      `}</style>
    </div>
  )
}