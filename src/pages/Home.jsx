import React, { useState, useEffect, useRef } from "react";
import "../Styles/home.css"; 

const API_URL = 'https://script.google.com/macros/s/AKfycbxD4jakTaR2OXuy8Wnl6Yp6Nw24d3fmb0cLeNOkbTYzb7dNyZ0ywteSwc4qt7_IdOWV/exec';

const BASE_EMOJIS = ["🐶", "🍎", "🚗", "🍕", "🌈", "😊", "🏀", "🏢", "👧", "🍦", "📚", "🎸", "🦋", "🐈", "🍟", "🌻", "🚀", "💎", "🧸", "🔒"];

const GRADOS_OPTIONS = [
    "PRE JARDIN PJ", "JARDIN JA", "TRANSICION TR", "PRIMERO 101", "SEGUNDO 201", "TERCERO 301", 
    "CUARTO 401", "QUINTO 501", "SEXTO 601", "SEPTIMO 701", "OCTAVO 801", "NOVENO 901", 
    "DECIMO 1001", "ONCE 1101", "PERSONAL"
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
    const [actionLoading, setActionLoading] = useState(null); 

    const isSyncingRef = useRef(0);

    const [userRole, setUserRole] = useState("admin"); 
    const correctSequence = ["🏢", "👧", "😊", "🍕"]; 
    const logisticsSequence = ["🏢", "📚", "😊", "🍎"]; 

    const [formData, setFormData] = useState({ id: '', grado: GRADOS_OPTIONS[0], nombre: '', observacion: '' });

    const getCategorizedReport = () => {
        const categories = [
            { title: "🧸 PREESCOLAR", list: [{ label: "PRE JARDIN", match: "PRE JARDIN PJ" }, { label: "JARDIN", match: "JARDIN JA" }, { label: "TRANSICION", match: "TRANSICION TR" }] },
            { title: "📚 PRIMERO A TERCERO", list: [{ label: "PRIMERO", match: "PRIMERO 101" }, { label: "SEGUNDO", match: "SEGUNDO 201" }, { label: "TERCERO", match: "TERCERO 301" }] },
            { title: "🍎 CUARTO A QUINTO", list: [{ label: "CUARTO", match: "CUARTO 401" }, { label: "QUINTO", match: "QUINTO 501" }] },
            { title: "🎓 BACHILLERATO", list: [{ label: "SEXTO", match: "SEXTO 601" }, { label: "SEPTIMO", match: "SEPTIMO 701" }, { label: "OCTAVO", match: "OCTAVO 801" }, { label: "NOVENO", match: "NOVENO 901" }, { label: "DECIMO", match: "DECIMO 1001" }, { label: "ONCE", match: "ONCE 1101" }] },
            { title: "👥 OTROS", list: [{ label: "PERSONAL", match: "PERSONAL" }] }
        ];

        return categories.map(cat => {
            let totalPendientes = 0;
            let totalAlmorzados = 0;
            const items = cat.list.map(gradoObj => {
                const estudiantesGrado = students.filter(s => {
                    const gradoExcel = String(s.GRADO || "").toUpperCase().trim();
                    const gradoBuscado = gradoObj.match.toUpperCase().trim();
                    return gradoExcel === gradoBuscado;
                });
                const pendientes = estudiantesGrado.filter(s => {
                    const ef = String(s["ESTADO FINAL"] || s["ESTADO_FINAL"] || "").trim();
                    return ef === "";
                }).length;
                const almorzados = estudiantesGrado.filter(s => {
                    const ef = String(s["ESTADO FINAL"] || s["ESTADO_FINAL"] || "").trim();
                    return ef === "ALMORZANDO";
                }).length;
                totalPendientes += pendientes;
                totalAlmorzados += almorzados;
                return { grado: gradoObj.label, pendientes, almorzados, total: estudiantesGrado.length };
            }).filter(item => item.total > 0);
            return { categoryTitle: cat.title, items, totalPendientes, totalAlmorzados };
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
            setFormData(prev => ({ ...prev, id: nextId, grado: GRADOS_OPTIONS[0] }));
        }
    }, [view, students.length]);

    useEffect(() => {
        setShuffledEmojis(shuffle(BASE_EMOJIS));
    }, []);

    const shuffle = (array) => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setUserSequence([]);
        setUserRole("admin");
    };

    const fetchData = async () => {
        if (isSyncingRef.current > 0) return; 
        
        setLoading(true);
        try {
            const res = await fetch(API_URL);
            const data = await res.json();
            if (isSyncingRef.current === 0) {
                setStudents(data.filter(s => {
                    const estadoRaw = s["ESTADO INICIAL"] || s["ESTADO_INICIAL"] || "";
                    const estado = String(estadoRaw).toUpperCase().trim();
                    return estado === "OK" || estado === "D";
                }));
            }
        } catch (err) {
            console.error("Error cargando datos", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action, rowId, extra = {}) => {
        if (action === 'mark_lunch') {
            setActionLoading(rowId);
            setTimeout(() => setActionLoading(null), 800);
        }

        isSyncingRef.current += 1;
        setPendingSyncCount(prev => prev + 1);
        
        // Cambio visual inmediato
        setStudents(prevStudents => {
            if (action === 'delete') {
                return prevStudents.filter(s => s.rowId !== rowId);
            }
            return prevStudents.map(s => {
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
                    return { ...s, "ESTADO FINAL": nuevoEstadoFinal, ESTADO_FINAL: nuevoEstadoFinal, OBSERVACION: nuevaObservacion };
                }
                return s;
            });
        });

        try {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, rowId, ...extra })
            });
        } catch (err) {
            console.error("Error sincronizando", err);
        } finally {
            setTimeout(() => {
                isSyncingRef.current -= 1;
                setPendingSyncCount(prev => {
                    const newValue = prev - 1;
                    if (newValue === 0) fetchData();
                    return newValue;
                });
            }, 4500);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        const currentForm = { ...formData };
        
        const newStudentLocal = {
            rowId: Date.now(), 
            ID: currentForm.id, 
            GRADO: currentForm.grado, 
            NOMBRE: currentForm.nombre,
            OBSERVACION: currentForm.observacion, 
            "ESTADO FINAL": "", 
            "ESTADO INICIAL": "D"
        };
        
        setStudents(prev => [...prev, newStudentLocal]);
        isSyncingRef.current += 1;
        setPendingSyncCount(prev => prev + 1);
        setView("list");
        setFormData({ id: '', grado: GRADOS_OPTIONS[0], nombre: '', observacion: '' });

        try {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', ...currentForm })
            });
        } catch (err) {
            console.error("Error al crear remotamente", err);
        } finally {
            setTimeout(() => {
                isSyncingRef.current -= 1;
                setPendingSyncCount(prev => {
                    const newValue = prev - 1;
                    if (newValue === 0) fetchData();
                    return newValue;
                });
            }, 5000);
        }
    };

    const handleLogin = () => {
        const inputSeq = JSON.stringify(userSequence);
        if (inputSeq === JSON.stringify(correctSequence)) {
            setUserRole("admin");
            setIsLoggedIn(true);
            fetchData();
        } else if (inputSeq === JSON.stringify(logisticsSequence)) {
            setUserRole("llamado");
            setIsLoggedIn(true);
            setActiveTab("pendientes");
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
        const ef = String(s["ESTADO FINAL"] || s["ESTADO_FINAL"] || "").trim();
        return ef === "";
    });
    
    const completados = students.filter(s => {
        const ef = String(s["ESTADO FINAL"] || s["ESTADO_FINAL"] || "").trim();
        return ef === "ALMORZANDO" || ef === "INASISTENTE";
    });

    return (
        <div className="app-wrapper">
            {pendingSyncCount > 0 && (
                <div className="sync-badge-floating">
                    <div className="sync-spinner"></div>
                    Sincronizando {pendingSyncCount} cambios...
                </div>
            )}

            <header className="main-header">
                <div className="header-top">
                    <div>
                        <h1>{userRole === "llamado" ? "Lista de Llamado" : "Almuerzos 2026"}</h1>
                        <button className="logout-link" onClick={handleLogout}>🚪 Cerrar Sesión</button>
                    </div>
                </div>
                {userRole === "admin" && (
                    <div className="header-actions">
                        <button className="btn-report" onClick={() => setShowReport(true)}>📊 REPORTE</button>
                        <button className="btn-add-student" onClick={() => setView(view === "form" ? "list" : "form")}>
                            {view === "form" ? "⬅️ VOLVER" : "➕ ESTUDIANTE"}
                        </button>
                    </div>
                )}
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
                                        <thead><tr><th>Grado</th><th>Faltan</th><th>Listos</th></tr></thead>
                                        <tbody>
                                            {cat.items.map(r => (
                                                <tr key={r.grado}>
                                                    <td><strong>{r.grado}</strong></td>
                                                    <td className={r.pendientes > 0 ? "text-red" : "text-gray"}>{r.pendientes}</td>
                                                    <td className="text-green">{r.almorzados}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="report-tfoot">
                                            <tr>
                                                <td><strong>TOTAL</strong></td>
                                                <td className="text-red"><strong>{cat.totalPendientes}</strong></td>
                                                <td className="text-green"><strong>{cat.totalAlmorzados}</strong></td>
                                            </tr>
                                        </tfoot>
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
                        <input placeholder="Nombre" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                        <label className="form-label">Observación Inicial:</label>
                        <input placeholder="Ej: Alérgico" value={formData.observacion} onChange={e => setFormData({...formData, observacion: e.target.value})} />
                        <button type="submit" className="btn-submit">GUARDAR</button>
                    </form>
                </div>
            ) : (
                <div className="content-area">
                    <div className="tabs-container">
                        {userRole === "admin" ? (
                            <>
                                <button className={`tab-btn ${activeTab === "pendientes" ? "active red" : ""}`} onClick={() => setActiveTab("pendientes")}>
                                    PENDIENTES ({pendientes.length})
                                </button>
                                <button className={`tab-btn ${activeTab === "almorzando" ? "active green" : ""}`} onClick={() => setActiveTab("almorzando")}>
                                    ALMORZANDO ({completados.length})
                                </button>
                            </>
                        ) : (
                            <h2 style={{padding: '10px', color: '#d32f2f'}}>ESTUDIANTES PENDIENTES ({pendientes.length})</h2>
                        )}
                    </div>

                    <div className="lists-container single-col">
                        {(activeTab === "pendientes" || userRole !== "admin") ? (
                            pendientes.length > 0 ? (
                                pendientes.map(s => (
                                    <div key={s.rowId} className="student-card">
                                        <div className="student-info">
                                            <span className="student-name">{s.NOMBRE}</span>
                                            <span className="student-meta">{s.GRADO}</span>
                                            {s.OBSERVACION && <div className="student-obs">📝 {s.OBSERVACION}</div>}
                                        </div>
                                        {userRole === "admin" && (
                                            <div className="card-actions">
                                                <button 
                                                    className="btn-action check" 
                                                    disabled={actionLoading === s.rowId}
                                                    onClick={() => handleAction('mark_lunch', s.rowId)}
                                                >
                                                    {actionLoading === s.rowId ? "⌛..." : "ALMORZAR ✅"}
                                                </button>
                                                <button className="btn-action absent" onClick={() => {
                                                    const obs = prompt("Observación de Inasistencia:", s.OBSERVACION || "");
                                                    if(obs !== null) handleAction('mark_absent', s.rowId, { observacion: obs });
                                                }}>🚫</button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : <div className="empty-msg">No hay pendientes 🎉</div>
                        ) : (
                            completados.map(s => (
                                <div key={s.rowId} className="student-card completed">
                                    <div className="student-info">
                                        <span className="student-name">{s.NOMBRE}</span>
                                        <span className="student-meta">
                                            {s.ESTADO_FINAL || "LISTO"} {s.OBSERVACION ? `(${s.OBSERVACION})` : ""}
                                        </span>
                                    </div>
                                    <div className="card-actions">
                                        <button className="btn-action undo" onClick={() => handleAction('undo_lunch', s.rowId)}>↩️ Corregir</button>
                                        <button className="btn-action absent" style={{background: '#ffebee', color: '#c62828'}} onClick={() => {
                                            if(window.confirm(`¿Seguro que quieres eliminar a ${s.NOMBRE} definitivamente del Excel?`)) {
                                                handleAction('delete', s.rowId);
                                            }
                                        }}>🗑️</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
            {loading && <div className="global-loader">Actualizando lista principal...</div>}
        </div>
    );
};