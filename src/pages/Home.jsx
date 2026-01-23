import React, { useState, useEffect } from "react";
import "../Styles/home.css"; 

const API_URL = 'https://script.google.com/macros/s/AKfycbxD4jakTaR2OXuy8Wnl6Yp6Nw24d3fmb0cLeNOkbTYzb7dNyZ0ywteSwc4qt7_IdOWV/exec';

const BASE_EMOJIS = ["🐶", "🍎", "🚗", "🍕", "🌈", "😊", "🏀", "🏢", "👧", "🍦", "📚", "🎸", "🦋", "🐈", "🍟", "🌻", "🚀", "💎", "🧸", "🔒"];

const GRADOS_OPTIONS = [
    "PRE JARDIN", "JARDIN", "TRANSICION", "PRIMERO", "SEGUNDO", "TERCERO", 
    "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE", "PERSONAL"
];

export const Home = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [view, setView] = useState("list"); 
    const [activeTab, setActiveTab] = useState("pendientes"); 
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [shuffledEmojis, setShuffledEmojis] = useState([]);
    const [userSequence, setUserSequence] = useState([]);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);
    const [showReport, setShowReport] = useState(false);

    const correctSequence = ["🏢", "👧", "😊", "🍕"];
    const [formData, setFormData] = useState({ id: '', grado: '', nombre: '', observacion: '' });

    // --- LÓGICA DE REPORTE AGRUPADO ---
    const getCategorizedReport = () => {
        const categories = [
            { title: "🧸 PREESCOLAR", list: ["PRE JARDIN", "JARDIN", "TRANSICION"] },
            { title: "📚 PRIMERO A TERCERO", list: ["PRIMERO", "SEGUNDO", "TERCERO"] },
            { title: "🍎 CUARTO A QUINTO", list: ["CUARTO", "QUINTO"] },
            { title: "🎓 BACHILLERATO", list: ["SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "ONCE"] },
            { title: "👥 OTROS", list: ["PERSONAL"] }
        ];

        return categories.map(cat => {
            const items = cat.list.map(grado => {
                const estudiantesGrado = students.filter(s => s.GRADO === grado);
                const pendientes = estudiantesGrado.filter(s => {
                    const ef = s["ESTADO FINAL"] || s["ESTADO_FINAL"] || "";
                    return ef.trim() === "";
                }).length;
                const almorzados = estudiantesGrado.filter(s => {
                    const ef = s["ESTADO FINAL"] || s["ESTADO_FINAL"] || "";
                    return ef === "ALMORZANDO";
                }).length;

                return { grado, pendientes, almorzados, total: pendientes + almorzados };
            }).filter(item => item.total > 0);
            return { categoryTitle: cat.title, items };
        }).filter(cat => cat.items.length > 0);
    };

    const generateNextId = (currentStudents) => {
        if (currentStudents.length === 0) return "1A";
        const ids = currentStudents.map(s => {
            const match = String(s.ID || "").match(/\d+/);
            return match ? parseInt(match[0]) : 0;
        });
        const maxId = Math.max(...ids, 0);
        return `${maxId + 1}A`;
    };

    useEffect(() => {
        if (view === "form") {
            const nextId = generateNextId(students);
            setFormData({ id: nextId, grado: GRADOS_OPTIONS[0], nombre: '', observacion: '' });
        }
    }, [view, students]);

    const shuffle = (array) => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    };

    useEffect(() => {
        setShuffledEmojis(shuffle(BASE_EMOJIS));
    }, []);

    const handleLogout = () => {
        setIsLoggedIn(false);
        setUserSequence([]);
    };

    // --- FETCH DATA (MEJORADO PARA EVITAR DELAY) ---
    const fetchData = async () => {
        // Si hay cambios enviándose, bloqueamos el refresco para que la UI no salte
        if (pendingSyncCount > 0) return; 
        
        setLoading(true);
        try {
            const res = await fetch(API_URL);
            const data = await res.json();
            
            // Verificamos de nuevo antes de setear para evitar colisiones
            setStudents(prev => {
                if (pendingSyncCount > 0) return prev;
                return data.filter(s => {
                    const estadoRaw = s["ESTADO INICIAL"] || s["ESTADO_INICIAL"] || "";
                    const estado = String(estadoRaw).toUpperCase().trim();
                    return estado === "OK" || estado === "D";
                });
            });
        } catch (err) {
            console.error("Error cargando datos", err);
        } finally {
            setLoading(false);
        }
    };

    // --- ACCIÓN OPTIMISTA (INSTANTÁNEA) ---
    const handleAction = async (action, rowId, extra = {}) => {
        // 1. Bloqueamos refrescos externos aumentand el contador
        setPendingSyncCount(prev => prev + 1);

        // 2. CAMBIO LOCAL INMEDIATO
        setStudents(prevStudents => 
            prevStudents.map(s => {
                if (s.rowId === rowId) {
                    let nuevoEstadoFinal = "";
                    let nuevaObservacion = s.OBSERVACION || "";

                    if (action === 'mark_lunch') nuevoEstadoFinal = "ALMORZANDO";
                    else if (action === 'mark_absent') {
                        nuevoEstadoFinal = "INASISTENTE";
                        nuevaObservacion = extra.observacion || "";
                    } else if (action === 'undo_lunch') {
                        nuevoEstadoFinal = ""; 
                        nuevaObservacion = "";
                    }

                    return {
                        ...s,
                        "ESTADO FINAL": nuevoEstadoFinal,
                        ESTADO_FINAL: nuevoEstadoFinal,
                        OBSERVACION: nuevaObservacion
                    };
                }
                return s;
            })
        );

        // 3. ENVIAR AL EXCEL EN SEGUNDO PLANO
        try {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({ action, rowId, ...extra })
            });
        } catch (err) {
            console.error("Error sincronizando", err);
        } finally {
            // 4. Liberar bloqueo tras un pequeño delay de seguridad
            setPendingSyncCount(prev => {
                const newValue = prev - 1;
                if (newValue === 0) setTimeout(() => fetchData(), 3500);
                return newValue;
            });
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        const newStudentLocal = {
            rowId: Date.now(),
            ID: formData.id,
            GRADO: formData.grado,
            NOMBRE: formData.nombre,
            OBSERVACION: formData.observacion,
            "ESTADO FINAL": "",
            "ESTADO INICIAL": "D"
        };

        setStudents(prev => [...prev, newStudentLocal]);
        setPendingSyncCount(prev => prev + 1);
        setView("list");

        try {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({ action: 'create', ...formData })
            });
        } catch (err) {
            console.error("Error al crear remotamente", err);
        } finally {
            setPendingSyncCount(prev => {
                const newValue = prev - 1;
                if (newValue === 0) setTimeout(() => fetchData(), 3500);
                return newValue;
            });
        }
    };

    const handleLogin = () => {
        if (JSON.stringify(userSequence) === JSON.stringify(correctSequence)) {
            setIsLoggedIn(true);
            fetchData();
        } else {
            setUserSequence([]);
            setShuffledEmojis(shuffle(BASE_EMOJIS));
        }
    };

    if (!isLoggedIn) {
        return (
            <div className="login-container">
                <div className="login-card">
                    <h2>CREAR LUNCH 🍱</h2>
                    <div className="emoji-slots">
                        {[0, 1, 2, 3].map(i => <div key={i} className="slot">{userSequence[i] || ""}</div>)}
                    </div>
                    <div className="emoji-grid">
                        {shuffledEmojis.map((e, i) => (
                            <button key={i} className="emoji-btn" onClick={() => setUserSequence([...userSequence, e].slice(0,4))}>{e}</button>
                        ))}
                    </div>
                    <button className="btn-login" onClick={handleLogin}>ACCEDER</button>
                    <button className="reset-link" onClick={() => setUserSequence([])}>Reiniciar</button>
                </div>
            </div>
        );
    }

    const pendientes = students.filter(s => {
        const ef = s["ESTADO FINAL"] || s["ESTADO_FINAL"] || "";
        return ef.trim() === "";
    });
    
    const completados = students.filter(s => {
        const ef = s["ESTADO FINAL"] || s["ESTADO_FINAL"] || "";
        return ef === "ALMORZANDO" || ef === "INASISTENTE";
    });

    return (
        <div className="app-wrapper">
            <header className="main-header">
                <div className="header-top">
                    <div>
                        <h1>Almuerzos 2026</h1>
                        <button className="logout-link" onClick={handleLogout}>🚪 Cerrar Sesión</button>
                    </div>
                </div>
                <div className="header-actions">
                    <button className="btn-report" onClick={() => setShowReport(true)}>📊 REPORTE</button>
                    <button className="btn-add-student" onClick={() => setView(view === "form" ? "list" : "form")}>
                        {view === "form" ? "⬅️ VOLVER" : "➕ ESTUDIANTE"}
                    </button>
                </div>
            </header>

            {showReport && (
                <div className="modal-overlay" onClick={() => setShowReport(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Resumen Logístico</h3>
                            <button className="close-modal" onClick={() => setShowReport(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            {getCategorizedReport().map(cat => (
                                <div key={cat.categoryTitle} className="report-category">
                                    <h4 className="category-title">{cat.categoryTitle}</h4>
                                    <table className="report-table">
                                        <thead>
                                            <tr>
                                                <th>Grado</th>
                                                <th>Faltan</th>
                                                <th>Listos</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cat.items.map(r => (
                                                <tr key={r.grado}>
                                                    <td><strong>{r.grado}</strong></td>
                                                    <td className={r.pendientes > 0 ? "text-red" : "text-gray"}>{r.pendientes}</td>
                                                    <td className="text-green">{r.almorzados}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {view === "form" ? (
                <div className="form-container">
                    <form onSubmit={handleCreate} className="lunch-form">
                        <h3>Nuevo Registro</h3>
                        <label className="form-label">ID Sugerido:</label>
                        <input placeholder="ID" required readOnly value={formData.id} />
                        <label className="form-label">Grado:</label>
                        <select className="form-select" value={formData.grado} onChange={e => setFormData({...formData, grado: e.target.value})} required>
                            {GRADOS_OPTIONS.map(g => (<option key={g} value={g}>{g}</option>))}
                        </select>
                        <label className="form-label">Nombre Completo:</label>
                        <input placeholder="Nombre del estudiante" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                        <label className="form-label">Observación Inicial:</label>
                        <input placeholder="Ej: Alérgico a la lactosa" value={formData.observacion} onChange={e => setFormData({...formData, observacion: e.target.value})} />
                        <button type="submit" className="btn-submit">GUARDAR</button>
                    </form>
                </div>
            ) : (
                <div className="content-area">
                    <div className="tabs-container">
                        <button className={`tab-btn ${activeTab === "pendientes" ? "active red" : ""}`} onClick={() => setActiveTab("pendientes")}>
                            PENDIENTES ({pendientes.length})
                        </button>
                        <button className={`tab-btn ${activeTab === "almorzando" ? "active green" : ""}`} onClick={() => setActiveTab("almorzando")}>
                            ALMORZANDO ({completados.length})
                        </button>
                    </div>

                    <div className="lists-container single-col">
                        {activeTab === "pendientes" ? (
                            pendientes.length > 0 ? (
                                pendientes.map(s => (
                                    <div key={s.rowId} className="student-card">
                                        <div className="student-info">
                                            <span className="student-name">{s.NOMBRE}</span>
                                            <span className="student-meta">{s.GRADO} (ESTADO: {s["VALOR 1"] || s["VALOR_1"] || s.ID})</span>
                                            {s.OBSERVACION && <div className="student-obs">📝 {s.OBSERVACION}</div>}
                                        </div>
                                        <div className="card-actions">
                                            <button className="btn-action check" onClick={() => handleAction('mark_lunch', s.rowId)}>ALMORZAR ✅</button>
                                            <button className="btn-action absent" onClick={() => {
                                                const obs = prompt("Observación de Inasistencia:", s.OBSERVACION || "");
                                                if(obs !== null) handleAction('mark_absent', s.rowId, { observacion: obs });
                                            }}>🚫</button>
                                        </div>
                                    </div>
                                ))
                            ) : <div className="empty-msg">No hay pendientes 🎉</div>
                        ) : (
                            completados.map(s => (
                                <div key={s.rowId} className="student-card completed">
                                    <div className="student-info">
                                        <span className="student-name">{s.NOMBRE}</span>
                                        <span className="student-meta">
                                            {s.ESTADO_FINAL} {s.OBSERVACION ? `(${s.OBSERVACION})` : ""}
                                        </span>
                                    </div>
                                    <div className="card-actions">
                                        <button className="btn-action undo" onClick={() => handleAction('undo_lunch', s.rowId)}>↩️ Corregir</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {pendingSyncCount > 0 && (
                        <div className="sync-badge-floating">
                            <div className="sync-spinner"></div>
                            <span>Guardando en la nube...</span>
                        </div>
                    )}
                </div>
            )}
            {loading && <div className="global-loader">Actualizando datos...</div>}
        </div>
    );
};