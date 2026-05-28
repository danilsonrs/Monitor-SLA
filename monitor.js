// ==UserScript==
// @name         SLA MONITOR FINAL - CENTRO DE CONTROLE
// @namespace    http://tampermonkey.net/
// @version      7.4
// @description  Monitor SLA + Painéis Arrastáveis + Correção Leitura de Dados (Limites Dinâmicos)
// @match        https://naturgy.custhelp.com/AgentWeb/*
// @grant        none
// ==/UserScript==

(function () {

    'use strict';

    console.log("SLA MONITOR - CENTRO DE CONTROLE INICIADO (V7.4)");

    // =========================
    // VARIÁVEIS DE ESTADO (MEMÓRIA)
    // =========================
    let monitorSlaAtivo = false;
    let alertaNovasOsAtivo = false;
    let mostrarAtendidas = true; 
    let slasSilenciados = false;
    
    let osConhecidas = new Set();
    let modalAberto = false;
    let loopAlarmeNovo = null;

    let ultimoAlertaSla = 0;
    let intervaloAtualAlertaSla = 60000;

    // =========================
    // MOTOR DE ARRASTAR JANELAS (DRAG & DROP)
    // =========================
    function tornarArrastavel(elementoJanela, elementoPuxador) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        elementoPuxador.style.cursor = "grab";
        elementoPuxador.style.userSelect = "none";

        elementoPuxador.onmousedown = function(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            const rect = elementoJanela.getBoundingClientRect();
            elementoJanela.style.bottom = "auto";
            elementoJanela.style.right = "auto";
            elementoJanela.style.top = rect.top + "px";
            elementoJanela.style.left = rect.left + "px";

            document.onmouseup = pararArrasto;
            document.onmousemove = arrastarElemento;
            elementoPuxador.style.cursor = "grabbing";
        };

        function arrastarElemento(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            elementoJanela.style.top = (elementoJanela.offsetTop - pos2) + "px";
            elementoJanela.style.left = (elementoJanela.offsetLeft - pos1) + "px";
        }

        function pararArrasto() {
            document.onmouseup = null;
            document.onmousemove = null;
            elementoPuxador.style.cursor = "grab";
        }
    }

    // =========================
    // INTERFACE: PAINEL DE CONTROLE
    // =========================
    const painelControle = document.createElement("div");
    painelControle.style.position = "fixed";
    painelControle.style.bottom = "20px"; 
    painelControle.style.left = "20px";
    painelControle.style.width = "220px";
    painelControle.style.zIndex = "999999999";
    painelControle.style.background = "#1e1e1e";
    painelControle.style.color = "white";
    painelControle.style.fontFamily = "Arial";
    painelControle.style.border = "2px solid #555";
    painelControle.style.borderRadius = "10px";
    painelControle.style.boxShadow = "0 0 15px rgba(0,0,0,0.5)";
    painelControle.style.overflow = "hidden";
    
    const cabecalhoControle = document.createElement("div");
    cabecalhoControle.style.padding = "10px";
    cabecalhoControle.style.background = "#333";
    cabecalhoControle.style.textAlign = "center";
    cabecalhoControle.style.fontWeight = "bold";
    cabecalhoControle.style.borderBottom = "1px solid #555";
    cabecalhoControle.innerText = "🎛️ Centro de Controle";
    painelControle.appendChild(cabecalhoControle);

    const corpoControle = document.createElement("div");
    corpoControle.style.padding = "15px";
    corpoControle.innerHTML = `
        <label style="display:flex; align-items:center; cursor:pointer; margin-bottom:12px; font-size:14px;">
            <input type="checkbox" id="chkMonitorSla" style="width:18px; height:18px; margin-right:8px; cursor:pointer;">
            Monitor de SLA
        </label>
        <label style="display:flex; align-items:center; cursor:pointer; margin-bottom:12px; font-size:14px;">
            <input type="checkbox" id="chkMostrarAtendidas" checked style="width:18px; height:18px; margin-right:8px; cursor:pointer;">
            Exibir Atendidas
        </label>
        <label style="display:flex; align-items:center; cursor:pointer; font-size:14px;">
            <input type="checkbox" id="chkNovasOs" style="width:18px; height:18px; margin-right:8px; cursor:pointer;">
            Alerta Novas OSs
        </label>
    `;
    painelControle.appendChild(corpoControle);
    document.body.appendChild(painelControle);

    tornarArrastavel(painelControle, cabecalhoControle);

    // =========================
    // INTERFACE: PAINEL DE SLA
    // =========================
    const painelSlaContainer = document.createElement("div");
    painelSlaContainer.style.position = "fixed";
    painelSlaContainer.style.top = "20px";
    painelSlaContainer.style.right = "20px";
    
    painelSlaContainer.style.width = "auto"; 
    painelSlaContainer.style.minWidth = "280px"; 
    painelSlaContainer.style.maxWidth = "450px"; 
    
    painelSlaContainer.style.zIndex = "999999998";
    painelSlaContainer.style.background = "#111";
    painelSlaContainer.style.color = "white";
    painelSlaContainer.style.fontFamily = "Arial";
    painelSlaContainer.style.border = "2px solid #555";
    painelSlaContainer.style.borderRadius = "10px";
    painelSlaContainer.style.boxShadow = "0 0 15px rgba(0,0,0,0.5)";
    painelSlaContainer.style.overflow = "hidden";
    painelSlaContainer.style.display = "none"; 

    const cabecalhoSla = document.createElement("div");
    cabecalhoSla.style.padding = "12px";
    cabecalhoSla.style.background = "#333";
    cabecalhoSla.style.borderBottom = "1px solid #555";
    cabecalhoSla.style.display = "flex";
    cabecalhoSla.style.justifyContent = "space-between";
    cabecalhoSla.style.alignItems = "center";
    
    cabecalhoSla.innerHTML = `
        <div style="display:flex; align-items:center;">
            <span style="font-size:16px; font-weight:bold; margin-right:10px;">🚨 Monitor SLA</span>
            <span id="btnMuteSla" style="cursor:pointer; font-size:18px;" title="Silenciar Alertas de SLA">🔊</span>
        </div>
        <span style="font-size:11px; opacity:0.7;">Arraste aqui</span>
    `;
    painelSlaContainer.appendChild(cabecalhoSla);

    const corpoSla = document.createElement("div");
    corpoSla.style.padding = "12px";
    corpoSla.style.maxHeight = "80vh";
    corpoSla.style.overflowY = "auto";
    painelSlaContainer.appendChild(corpoSla);
    document.body.appendChild(painelSlaContainer);

    tornarArrastavel(painelSlaContainer, cabecalhoSla);

    // =========================
    // EVENTOS: MUDO DO SLA E BOTÕES
    // =========================
    const btnMuteSla = cabecalhoSla.querySelector("#btnMuteSla");
    
    btnMuteSla.onmousedown = function(e) { e.stopPropagation(); };
    
    btnMuteSla.onclick = function() {
        slasSilenciados = !slasSilenciados;
        btnMuteSla.innerText = slasSilenciados ? "🔇" : "🔊";
        btnMuteSla.title = slasSilenciados ? "Alertas de SLA Silenciados" : "Silenciar Alertas de SLA";
        if (slasSilenciados && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    };

    document.getElementById("chkMonitorSla").addEventListener("change", (e) => {
        monitorSlaAtivo = e.target.checked;
        if (monitorSlaAtivo) {
            painelSlaContainer.style.display = "block";
        } else {
            painelSlaContainer.style.display = "none";
            corpoSla.innerHTML = ""; 
        }
    });

    document.getElementById("chkMostrarAtendidas").addEventListener("change", (e) => {
        mostrarAtendidas = e.target.checked;
    });

    document.getElementById("chkNovasOs").addEventListener("change", (e) => {
        alertaNovasOsAtivo = e.target.checked;
        if (alertaNovasOsAtivo) {
            const ocorrenciasVisiveis = extrairOcorrenciasDaTela();
            osConhecidas.clear();
            ocorrenciasVisiveis.forEach(o => osConhecidas.add(o.os));
            console.log("Monitor de Novas OSs Armado. OSs conhecidas:", osConhecidas.size);
        } else {
            osConhecidas.clear();
        }
    });

    // =========================
    // MODAL E ÁUDIO
    // =========================
    const modalNovaOs = document.createElement("div");
    modalNovaOs.style.position = "fixed";
    modalNovaOs.style.inset = "0";
    modalNovaOs.style.background = "rgba(0, 0, 0, 0.85)";
    modalNovaOs.style.zIndex = "9999999999";
    modalNovaOs.style.display = "none";
    modalNovaOs.style.alignItems = "center";
    modalNovaOs.style.justifyContent = "center";
    
    const modalContent = document.createElement("div");
    modalContent.style.background = "#0f172a";
    modalContent.style.border = "3px solid #3b82f6";
    modalContent.style.borderRadius = "15px";
    modalContent.style.padding = "30px";
    modalContent.style.textAlign = "center";
    modalContent.style.color = "white";
    modalContent.style.fontFamily = "Arial";
    modalContent.style.minWidth = "350px";
    modalContent.style.maxWidth = "500px";
    modalContent.style.boxShadow = "0 0 30px rgba(59, 130, 246, 0.5)";
    modalNovaOs.appendChild(modalContent);
    document.body.appendChild(modalNovaOs);

    function tocarCampainhaSuave() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const t = ctx.currentTime;
            function criarNota(freq, inicio) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = "sine";
                osc.frequency.value = freq;
                osc.start(inicio);
                gain.gain.setValueAtTime(0, inicio);
                gain.gain.linearRampToValueAtTime(0.1, inicio + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.8);
                osc.stop(inicio + 0.8);
            }
            criarNota(880, t);         
            criarNota(1108.53, t + 0.25); 
        } catch(e) {}
    }

    function emitirBipe(audioCtx, tempoInicio) {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = "sine";
        oscillator.frequency.value = 880;
        oscillator.start(tempoInicio);
        gainNode.gain.setValueAtTime(1, tempoInicio);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, tempoInicio + 0.15);
        oscillator.stop(tempoInicio + 0.15);
    }

    function dispararVoz(texto) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); 
            const msg = new SpeechSynthesisUtterance(texto);
            msg.lang = 'pt-BR'; 
            msg.rate = 1.1;     
            msg.pitch = 1.0;    
            window.speechSynthesis.speak(msg);
        }
    }

    function executarAlarmeHibridoSLA(modo, fraseVoz) {
        const agora = Date.now();
        const tempoEspera = modo === "critico" ? 60000 : 120000;

        if (tempoEspera !== intervaloAtualAlertaSla || (agora - ultimoAlertaSla >= tempoEspera)) {
            ultimoAlertaSla = agora;
            intervaloAtualAlertaSla = tempoEspera;

            if (modo === "critico") {
                try {
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const tempoAtual = audioCtx.currentTime;
                    for (let i = 0; i < 5; i++) {
                        emitirBipe(audioCtx, tempoAtual + (i * 0.3));
                    }
                    setTimeout(() => { dispararVoz(fraseVoz); }, 1500);
                } catch (e) {
                    dispararVoz(fraseVoz);
                }
            } else {
                dispararVoz(fraseVoz);
            }
        }
    }

    // =========================
    // FUNÇÕES DE TEMPO E EXTRATOR DE DADOS (CORRIGIDO)
    // =========================
    function minutosRestantes(dataTexto) {
        const partes = dataTexto.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
        if (!partes) return null;
        const data = new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]), Number(partes[4]), Number(partes[5]));
        return Math.round((data - new Date()) / 1000 / 60);
    }

    function extrairTimestamp(dataTexto) {
        if (!dataTexto || dataTexto.toUpperCase().includes("NENHUM")) return 0;
        const partes = dataTexto.match(/(\d{2})\/(\d{2})\/(\d{4} \d{2}:\d{2})/);
        if (!partes) return 0;
        return new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]), Number(partes[4]), Number(partes[5])).getTime();
    }

    function extrairOcorrenciasDaTela() {
        const spans = document.querySelectorAll("span");
        let blocos = [];

        spans.forEach(span => {
            const title = span.getAttribute("title");
            if (!title || !title.includes("Previsão de Vencimento da SLA")) return;
            const container = span.parentElement?.parentElement;
            if (!container) return;
            const texto = container.innerText;
            if (texto && !blocos.includes(texto)) {
                blocos.push(texto);
            }
        });

        let ocorrenciasBrutas = [];

        blocos.forEach(texto => {
            const lines = texto.split("\n").map(x => x.trim()).filter(Boolean);
            
            // NOVO MÉTODO: Mapeia onde cada OS começa para não misturar os dados
            let indicesOs = [];
            lines.forEach((linha, i) => {
                if (/^\d{6}-\d+$/.test(linha)) {
                    indicesOs.push(i);
                }
            });

            // Processa cada OS isoladamente
            indicesOs.forEach((indiceAtual, idx) => {
                const os = lines[indiceAtual];
                const indiceProximo = indicesOs[idx + 1] || lines.length;
                
                // Corta exatamente do número dessa OS até o início da próxima
                const trechoBruto = lines.slice(indiceAtual, indiceProximo);
                
                let tokens = [];
                trechoBruto.forEach(l => {
                    const partes = l.split(/\t/).map(x => x.trim()).filter(Boolean);
                    tokens.push(...partes);
                });

                const cronologia = [];
                let atrasado = "Não";
                let cancelada = false; 
                let atrasadoEncontrado = false;

                tokens.forEach(token => {
                    const textoLimpo = token.toUpperCase();
                    
                    if (textoLimpo.includes("CANCELAD")) {
                        cancelada = true;
                    }

                    const regexData = /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/g;
                    let match;
                    let achouData = false;
                    while ((match = regexData.exec(token)) !== null) {
                        cronologia.push(match[0]);
                        achouData = true;
                    }
                    if (!achouData) {
                        if (textoLimpo.includes("NENHUM VALOR")) {
                            cronologia.push("Nenhum Valor");
                        } else if (!atrasadoEncontrado && (textoLimpo === "SIM" || textoLimpo === "NÃO")) {
                            atrasado = textoLimpo === "SIM" ? "Sim" : "Não";
                            atrasadoEncontrado = true;
                        }
                    }
                });

                if (cronologia.length < 2) return;
                const sla = cronologia[1];
                const horaChegada = cronologia[3] || "Nenhum Valor";
                const minutos = minutosRestantes(sla);
                ocorrenciasBrutas.push({ os, sla, minutos, horaChegada, atrasado, cancelada });
            });
        });

        return ocorrenciasBrutas;
    }

    // =========================
    // LÓGICAS PRINCIPAIS DE MONITORAMENTO
    // =========================

    function processarPainelSLA(ocorrenciasBrutas) {
        let ocorrenciasMap = {};

        ocorrenciasBrutas.forEach(o => {
            const os = o.os;
            const semChegada = o.horaChegada.toUpperCase().includes("NENHUM");
            const atrasado = o.atrasado === "Sim";

            let rank = 1; 
            if (o.cancelada) {
                rank = 4; 
            } else if (!semChegada) { 
                rank = atrasado ? 2 : 3; 
            }

            const atual = ocorrenciasMap[os];
            if (!atual) {
                ocorrenciasMap[os] = { ...o, rank };
            } else if (rank > atual.rank) {
                ocorrenciasMap[os] = { ...o, rank };
            } else if (rank === atual.rank && !semChegada && !o.cancelada) {
                const tempoNovo = extrairTimestamp(o.horaChegada);
                const tempoAtual = extrairTimestamp(atual.horaChegada);
                if (tempoNovo < tempoAtual) {
                    ocorrenciasMap[os] = { ...o, rank };
                }
            }
        });

        let ocorrencias = Object.values(ocorrenciasMap);

        if (!mostrarAtendidas) {
            ocorrencias = ocorrencias.filter(o => o.horaChegada.toUpperCase().includes("NENHUM") && !o.cancelada);
        }

        ocorrencias.sort((a, b) => {
            const aPendente = a.horaChegada.toUpperCase().includes("NENHUM") && !a.cancelada;
            const bPendente = b.horaChegada.toUpperCase().includes("NENHUM") && !b.cancelada;

            if (aPendente && !bPendente) return -1;
            if (!aPendente && bPendente) return 1;

            if (aPendente && bPendente) {
                const ma = a.minutos == null ? 9999 : a.minutos;
                const mb = b.minutos == null ? 9999 : b.minutos;
                return ma - mb;
            }

            if (a.cancelada && !b.cancelada) return 1;
            if (!a.cancelada && b.cancelada) return -1;

            if (!aPendente && !bPendente) {
                const tA = extrairTimestamp(a.horaChegada);
                const tB = extrairTimestamp(b.horaChegada);
                return tB - tA;
            }
            return 0;
        });

        const pendentesCriticas = ocorrencias.filter(o => o.horaChegada.toUpperCase().includes("NENHUM") && o.minutos !== null && !o.cancelada);
        
        if (pendentesCriticas.length > 0 && !slasSilenciados) {
            const maisCritica = pendentesCriticas[0];
            const tempo = maisCritica.minutos;
            const finalOs = parseInt(maisCritica.os.split('-')[1], 10);

            if (tempo <= 5) {
                let textoCritico;
                if (tempo < 0) {
                    const tempoAtraso = Math.abs(tempo);
                    textoCritico = `Urgente! A ocorrência final ${finalOs}, está atrasada em ${tempoAtraso} minutos.`;
                } else {
                    textoCritico = `Urgente! Faltam ${tempo} minutos, para estourar o tempo, da ocorrência final ${finalOs}.`;
                }
                executarAlarmeHibridoSLA("critico", textoCritico);
                
            } else if (tempo <= 10) { 
                const textoAviso = `Aviso! Faltam ${tempo} minutos, para a ocorrência final ${finalOs}.`;
                executarAlarmeHibridoSLA("aviso", textoAviso);
            }
        }

        corpoSla.innerHTML = ocorrencias.length === 0 ? `<div style="text-align:center;">Nenhuma ocorrência na tela.</div>` : ocorrencias.map(o => {
            const semChegada = o.horaChegada.toUpperCase().includes("NENHUM");
            let cor = "#1e1e1e";

            if (o.cancelada) {
                cor = "#333333"; 
            } else if (semChegada) {
                if (o.minutos <= 15) cor = "#8b0000"; 
                else if (o.minutos <= 30) cor = "#b45309"; 
            } else {
                cor = o.atrasado === "Sim" ? "#7f1d1d" : "#14532d"; 
            }

            return `
                <div style="background:${cor}; padding:10px; margin-bottom:10px; border-radius:8px;">
                    <div style="font-weight:bold; font-size:14px; white-space:nowrap;">📌 ${o.os}</div>
                    <div style="margin-top:4px; font-size:12px;">⏰ SLA: ${o.sla}</div>
                    ${o.cancelada ? `
                        <div style="margin-top:10px; font-size:18px; font-weight:bold; color:#888;">
                            🚫 CANCELADA
                        </div>
                    ` : (semChegada ? `
                        <div style="margin-top:10px; font-size:28px; font-weight:bold;">⏳ ${o.minutos} min</div>
                    ` : `
                        <div style="margin-top:10px; font-size:14px; font-weight:bold;">
                            ${o.atrasado === "Sim" ? "🚨 ATENDIDA COM ATRASO" : "✅ ATENDIDA NO PRAZO"}
                        </div>
                        <div style="margin-top:6px; opacity:0.9; font-size:12px;">🚗 Chegada: ${o.horaChegada}</div>
                    `)}
                </div>
            `;
        }).join("");
    }

    function processarNovasOs(ocorrenciasBrutas) {
        if (modalAberto) return; 

        const osVisiveis = [...new Set(ocorrenciasBrutas.filter(o => !o.cancelada).map(o => o.os))];
        let novasEncontradas = [];

        osVisiveis.forEach(os => {
            if (!osConhecidas.has(os)) {
                novasEncontradas.push(os);
            }
        });

        if (novasEncontradas.length > 0) {
            modalAberto = true;

            modalContent.innerHTML = `
                <div style="font-size:35px; margin-bottom:10px;">🚨</div>
                <div style="font-size:24px; font-weight:bold; color:#3b82f6; margin-bottom:20px;">
                    NOVA OCORRÊNCIA DETECTADA!
                </div>
                
                <div style="font-size:18px; max-height: 400px; overflow-y: auto; margin-bottom:25px; color:#cbd5e1; padding-right: 10px;">
                    ${novasEncontradas.map(os => `<div style="margin-bottom:8px; background:#1e293b; padding:10px; border-radius:8px; text-align: left;">📌 ${os}</div>`).join('')}
                </div>

                <button id="btnConfirmaNovaOs" style="
                    background: #3b82f6; color: white; border: none; padding: 15px 30px; 
                    font-size: 18px; font-weight: bold; border-radius: 8px; cursor: pointer; width: 100%;
                    box-shadow: 0 5px 15px rgba(59, 130, 246, 0.3);
                ">OK, Ciente</button>
            `;

            modalNovaOs.style.display = "flex";

            tocarCampainhaSuave(); 
            loopAlarmeNovo = setInterval(tocarCampainhaSuave, 2500);

            document.getElementById("btnConfirmaNovaOs").onclick = () => {
                clearInterval(loopAlarmeNovo); 
                
                novasEncontradas.forEach(os => osConhecidas.add(os));
                
                modalNovaOs.style.display = "none";
                modalContent.innerHTML = "";
                modalAberto = false; 
            };
        }
    }

    // =========================
    // LOOP PRINCIPAL
    // =========================
    setInterval(() => {
        if (monitorSlaAtivo || alertaNovasOsAtivo) {
            const dadosTela = extrairOcorrenciasDaTela();

            if (monitorSlaAtivo) {
                processarPainelSLA(dadosTela);
            }
            if (alertaNovasOsAtivo) {
                processarNovasOs(dadosTela);
            }
        }
    }, 3000);

})();
