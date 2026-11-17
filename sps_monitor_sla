(function () {
    'use strict';

    console.log("SLA MONITOR - VERSÃO 8.11 INICIADA (PRODUÇÃO VIA NUVEM)");

    // === ESTADOS DO PAINEL ===
    let monitorSlaAtivo = false;
    let alertaNovasOsAtivo = false;
    let alertaTransmissaoAtivo = false;
    let mostrarAtendidas = false; 
    let mostrarOcultas = false; 
    let slasSilenciados = false;
    let filtrarP1P2 = false; 
    
    let timerMuteGlobal = null; 
    
    let osConhecidas = new Set();
    let osMutadas = new Set(); 
    let osOcultadas = new Set(); 
    
    let modalAberto = false;
    let loopAlarmeNovo = null;

    // === HISTÓRICOS DE ALARMES ===
    let ultimoAlertaSla = 0;
    let intervaloAtualAlertaSla = 60000;
    let historicoAlertasOS = {}; 
    let historicoAlertasTransmissao = {}; 

    // === FILA DE VOZ INDEPENDENTE ===
    let filaVoz = [];
    let isFalando = false;

    function processarFilaVoz() {
        if (isFalando || filaVoz.length === 0) return;
        if (!('speechSynthesis' in window)) return;

        isFalando = true;
        const texto = filaVoz.shift();
        const msg = new SpeechSynthesisUtterance(texto);
        msg.lang = 'pt-BR'; 
        msg.rate = 1.25; 
        
        msg.onend = () => {
            isFalando = false;
            setTimeout(processarFilaVoz, 600);
        };
        msg.onerror = () => {
            isFalando = false;
            setTimeout(processarFilaVoz, 600);
        };
        
        window.speechSynthesis.speak(msg);
    }

    function dispararVoz(texto) {
        if (slasSilenciados) return; 
        filaVoz.push(texto);
        processarFilaVoz();
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
                } catch (e) { dispararVoz(fraseVoz); }
            } else dispararVoz(fraseVoz);
        }
    }

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

    // === INTERFACE DO USUÁRIO ===
    function tornarArrastavel(elementoJanela, elementoPuxador) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        elementoPuxador.style.cursor = "grab";
        elementoPuxador.style.userSelect = "none";
        elementoPuxador.onmousedown = function(e) {
            e = e || window.event;
            if (e.target.closest('#btnMuteSla') || e.target.closest('#btnFiltroPrioridade')) return; 
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
    corpoControle.style.padding = "10px";
    corpoControle.style.display = "grid";
    corpoControle.style.gridTemplateColumns = "1fr 1fr";
    corpoControle.style.gap = "8px";
    corpoControle.innerHTML = `
        <label style="font-size:12px; cursor:pointer; display:flex; align-items:center;"><input type="checkbox" id="chkMonitorSla" style="margin-right:5px; width:14px; height:14px; cursor:pointer;"> Monitorar</label>
        <label style="font-size:12px; cursor:pointer; display:flex; align-items:center;"><input type="checkbox" id="chkMostrarAtendidas" style="margin-right:5px; width:14px; height:14px; cursor:pointer;"> Atendidas</label>
        <label style="font-size:12px; cursor:pointer; display:flex; align-items:center;"><input type="checkbox" id="chkMostrarOcultas" style="margin-right:5px; width:14px; height:14px; cursor:pointer;"> Ocultas</label>
        <label style="font-size:12px; cursor:pointer; display:flex; align-items:center;"><input type="checkbox" id="chkNovasOs" style="margin-right:5px; width:14px; height:14px; cursor:pointer;"> Alerta OS</label>
        <label style="font-size:12px; cursor:pointer; display:flex; align-items:center;"><input type="checkbox" id="chkAlertaTransmissao" style="margin-right:5px; width:14px; height:14px; cursor:pointer;"> Aceite OS</label>
    `;
    painelControle.appendChild(corpoControle);
    document.body.appendChild(painelControle);
    tornarArrastavel(painelControle, cabecalhoControle);

    document.getElementById("chkMonitorSla").checked = false;
    document.getElementById("chkAlertaTransmissao").checked = false;
    document.getElementById("chkMostrarAtendidas").checked = false;
    document.getElementById("chkMostrarOcultas").checked = false;
    document.getElementById("chkNovasOs").checked = false;

    const painelSlaContainer = document.createElement("div");
    painelSlaContainer.style.position = "fixed";
    painelSlaContainer.style.top = "20px";
    painelSlaContainer.style.right = "20px";
    painelSlaContainer.style.width = "auto"; 
    painelSlaContainer.style.minWidth = "290px"; 
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
            <span id="btnMuteSla" style="cursor:pointer; font-size:18px;" title="Silenciar TODOS os Alertas de Voz">🔊</span>
        </div>
        <span id="btnFiltroPrioridade" style="cursor:pointer; font-size:11px; background:rgba(255,255,255,0.15); padding:4px 8px; border-radius:4px; font-weight:bold; transition: background 0.2s;" title="Alternar Prioridades">⚡ Todos</span>
    `;
    painelSlaContainer.appendChild(cabecalhoSla);

    const corpoSla = document.createElement("div");
    corpoSla.style.padding = "12px";
    corpoSla.style.maxHeight = "80vh";
    corpoSla.style.overflowY = "auto";
    painelSlaContainer.appendChild(corpoSla);
    document.body.appendChild(painelSlaContainer);
    tornarArrastavel(painelSlaContainer, cabecalhoSla);

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

    // === EVENTOS DA INTERFACE ===
    const btnMuteSla = cabecalhoSla.querySelector("#btnMuteSla");
    btnMuteSla.onmousedown = function(e) { e.stopPropagation(); };
    btnMuteSla.onclick = function() {
        slasSilenciados = !slasSilenciados;
        btnMuteSla.innerText = slasSilenciados ? "🔇" : "🔊";
        
        if (slasSilenciados) {
            filaVoz = []; 
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            if (timerMuteGlobal) clearTimeout(timerMuteGlobal);
            timerMuteGlobal = setTimeout(() => {
                slasSilenciados = false;
                btnMuteSla.innerText = "🔊";
            }, 120000); 
        } else {
            if (timerMuteGlobal) clearTimeout(timerMuteGlobal);
        }
    };

    const btnFiltroPrioridade = cabecalhoSla.querySelector("#btnFiltroPrioridade");
    btnFiltroPrioridade.onmousedown = function(e) { e.stopPropagation(); };
    btnFiltroPrioridade.onclick = function() {
        filtrarP1P2 = !filtrarP1P2;
        btnFiltroPrioridade.innerText = filtrarP1P2 ? "⚡ P1 / P2" : "⚡ Todos";
        btnFiltroPrioridade.style.background = filtrarP1P2 ? "#b45309" : "rgba(255,255,255,0.15)";
    };

    corpoSla.addEventListener('click', (e) => {
        const btnMute = e.target.closest('.btn-mute-os');
        if (btnMute) {
            const os = btnMute.getAttribute('data-os');
            if (osMutadas.has(os)) {
                osMutadas.delete(os);
                btnMute.innerText = '🔊';
                btnMute.title = 'Mutar OS';
            } else {
                osMutadas.add(os);
                btnMute.innerText = '🔇';
                btnMute.title = 'Desmutar OS';
            }
        }

        const btnOcultar = e.target.closest('.btn-ocultar-os');
        if (btnOcultar) {
            const os = btnOcultar.getAttribute('data-os');
            if (osOcultadas.has(os)) {
                osOcultadas.delete(os);
                btnOcultar.innerText = '➖';
                btnOcultar.title = 'Ocultar OS';
            } else {
                osOcultadas.add(os);
                btnOcultar.innerText = '👁️';
                btnOcultar.title = 'Remover Ocultação';
            }
        }
    });

    document.getElementById("chkMonitorSla").addEventListener("change", (e) => {
        monitorSlaAtivo = e.target.checked;
        painelSlaContainer.style.display = monitorSlaAtivo ? "block" : "none";
        if (!monitorSlaAtivo) corpoSla.innerHTML = ""; 
    });

    document.getElementById("chkAlertaTransmissao").addEventListener("change", (e) => {
        alertaTransmissaoAtivo = e.target.checked;
    });

    document.getElementById("chkMostrarAtendidas").addEventListener("change", (e) => {mostrarAtendidas = e.target.checked;});
    document.getElementById("chkMostrarOcultas").addEventListener("change", (e) => {mostrarOcultas = e.target.checked;});
    document.getElementById("chkNovasOs").addEventListener("change", (e) => {
        alertaNovasOsAtivo = e.target.checked;
        if (alertaNovasOsAtivo) {
            const ocorrenciasVisiveis = extrairOcorrenciasDaTela();
            osConhecidas.clear();
            ocorrenciasVisiveis.forEach(o => osConhecidas.add(o.os));
        } else osConhecidas.clear();
    });

    // === FUNÇÕES DE EXTRAÇÃO ===
    function minutosRestantes(dataTexto) {
        const partes = dataTexto.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
        if (!partes) return null;
        const data = new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]), Number(partes[4]), Number(partes[5]));
        return Math.round((data - new Date()) / 1000 / 60);
    }

    function extrairTimestamp(dataTexto) {
        if (!dataTexto || dataTexto.toUpperCase().includes("NENHUM")) return 0;
        const partes = dataTexto.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
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
            if (texto && !blocos.includes(texto)) blocos.push(texto);
        });

        let ocorrenciasBrutas = [];
        blocos.forEach(texto => {
            const lines = texto.split("\n").map(x => x.trim()).filter(Boolean);
            let indicesOs = [];
            lines.forEach((linha, i) => { if (/^\d{6}-\d+$/.test(linha)) indicesOs.push(i); });

            indicesOs.forEach((indiceAtual, idx) => {
                const os = lines[indiceAtual];
                const indiceProximo = indicesOs[idx + 1] || lines.length;
                
                const trechoBruto = lines.slice(indiceAtual, indiceProximo);
                let tokens = [];
                trechoBruto.forEach(l => {
                    const partes = l.split(/\t/).map(x => x.trim()).filter(Boolean);
                    tokens.push(...partes);
                });

                const inicioTrechoAnterior = idx === 0 ? 0 : indicesOs[idx - 1] + 1;
                const trechoAnterior = lines.slice(inicioTrechoAnterior, indiceAtual);
                let tokensAnteriores = [];
                trechoAnterior.forEach(l => {
                    const partes = l.split(/\t/).map(x => x.trim()).filter(Boolean);
                    tokensAnteriores.push(...partes);
                });

                const cronologia = [];
                let atrasado = "Não";
                let cancelada = false; 
                let atrasadoEncontrado = false;
                let prioridade = "P3"; 
                let tipoAtividade = "";
                let tecnico = "";

                for (let j = tokensAnteriores.length - 1; j >= 0; j--) {
                    const t = tokensAnteriores[j].toUpperCase().trim();
                    if (/^P[1-5]$/.test(t)) {
                        prioridade = t;
                        if (j >= 2) tipoAtividade = tokensAnteriores[j - 2].toUpperCase().trim();
                        if (j >= 3) tecnico = tokensAnteriores[j - 3].trim();
                        break;
                    }
                }

                tokens.forEach(token => {
                    const textoLimpo = token.toUpperCase().trim();
                    if (textoLimpo.includes("CANCELAD")) cancelada = true;
                    
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
                const dataAbertura = cronologia[0]; 
                const sla = cronologia[1];
                const horaTransmissao = cronologia[2] || "Nenhum Valor";
                const horaChegada = cronologia[3] || "Nenhum Valor";
                const minutos = minutosRestantes(sla);
                
                ocorrenciasBrutas.push({ os, dataAbertura, sla, minutos, horaTransmissao, horaChegada, atrasado, cancelada, prioridade, tipoAtividade, tecnico });
            });
        });
        return ocorrenciasBrutas;
    }

    // === MOTORES DE PROCESSAMENTO ===
    function processarPainelSLA(ocorrenciasBrutas) {
        let ocorrenciasMap = {};

        // MAPEAMENTO GLOBAL DA OS: Verifica se ALGUÉM (Qualquer atividade) já transmitiu ou chegou
        const statusGlobalOS = {};
        ocorrenciasBrutas.forEach(o => {
            if (!statusGlobalOS[o.os]) statusGlobalOS[o.os] = { temTransmissao: false, temChegada: false };
            if (o.horaTransmissao && !o.horaTransmissao.toUpperCase().includes("NENHUM")) statusGlobalOS[o.os].temTransmissao = true;
            if (o.horaChegada && !o.horaChegada.toUpperCase().includes("NENHUM")) statusGlobalOS[o.os].temChegada = true;
        });

        ocorrenciasBrutas.forEach(o => {
            const os = o.os;
            const semChegada = o.horaChegada.toUpperCase().includes("NENHUM");
            const atrasado = o.atrasado === "Sim";

            let score = 1; 
            if (!o.cancelada) {
                if (!semChegada) score = atrasado ? 4 : 3; 
                else score = 2; 
            }

            const atual = ocorrenciasMap[os];
            if (!atual) {
                ocorrenciasMap[os] = { ...o, score };
            } else if (score > atual.score) {
                ocorrenciasMap[os] = { ...o, score };
            } else if (score === atual.score && !o.cancelada && !semChegada) {
                const tempoNovo = extrairTimestamp(o.horaChegada);
                const tempoAtual = extrairTimestamp(atual.horaChegada);
                if (tempoNovo < tempoAtual) ocorrenciasMap[os] = { ...o, score };
            }
        });

        let ocorrencias = Object.values(ocorrenciasMap);

        if (!mostrarAtendidas) {
            ocorrencias = ocorrencias.filter(o => o.horaChegada.toUpperCase().includes("NENHUM") && !o.cancelada);
        }

        if (!mostrarOcultas) {
            ocorrencias = ocorrencias.filter(o => !osOcultadas.has(o.os));
        }

        if (filtrarP1P2) {
            ocorrencias = ocorrencias.filter(o => o.prioridade === "P1" || o.prioridade === "P2");
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

        const pendentesCriticas = ocorrencias.filter(o => o.horaChegada.toUpperCase().includes("NENHUM") && o.minutos !== null && !o.cancelada && !osMutadas.has(o.os) && !osOcultadas.has(o.os));
        
        if (pendentesCriticas.length > 0) {
            const maisCritica = pendentesCriticas[0];
            const tempo = maisCritica.minutos;
            const finalOs = parseInt(maisCritica.os.split('-')[1], 10);
            const osKey = maisCritica.os;

            if (tempo > 0) { 
                if (!historicoAlertasOS[osKey]) {
                    historicoAlertasOS[osKey] = { alertado15: false, alertado10: false };
                }

                if (tempo === 15) {
                    if (!historicoAlertasOS[osKey].alertado15) {
                        historicoAlertasOS[osKey].alertado15 = true;
                        dispararVoz(`Aviso! Faltam 15 minutos para a ocorrência ${finalOs}.`);
                    }
                } else if (tempo === 10) {
                    if (!historicoAlertasOS[osKey].alertado10) {
                        historicoAlertasOS[osKey].alertado10 = true;
                        dispararVoz(`Aviso! Faltam 10 minutos para a ocorrência ${finalOs}.`);
                    }
                } else if (tempo <= 5) {
                    const tempoAbs = Math.abs(tempo);
                    const palavraMinuto = tempoAbs === 1 ? "minuto" : "minutos";
                    let textoCritico = `Urgente! Faltam ${tempoAbs} ${palavraMinuto} para o limite da ocorrência ${finalOs}.`;
                    executarAlarmeHibridoSLA("critico", textoCritico);
                }
            }
        }

        corpoSla.innerHTML = ocorrencias.length === 0 ? `<div style="text-align:center;">Nenhuma ocorrência na tela.</div>` : ocorrencias.map(o => {
            const semChegada = o.horaChegada.toUpperCase().includes("NENHUM");
            let cor = "#1e1e1e"; 

            if (o.cancelada) {
                cor = "#333333"; 
            } else if (semChegada) {
                if (o.minutos !== null && o.minutos <= 10) cor = "#8b0000";    
                else if (o.minutos !== null && o.minutos <= 15) cor = "#b45309"; 
            } else {
                cor = o.atrasado === "Sim" ? "#7f1d1d" : "#14532d"; 
            }

            let infoTransmissaoHtml = "";
            if (o.tipoAtividade === "PRINCIPAL") {
                const osStatus = statusGlobalOS[o.os];
                
                // NOVA TRAVA VISUAL: Só mostra alerta vermelho se NENHUMA linha dessa OS tiver transmissão ou chegada
                if (!osStatus.temTransmissao && !osStatus.temChegada) {
                    infoTransmissaoHtml = `<div style="margin-top:4px; font-size:12px; color:#fca5a5; font-weight:bold;">⚠️ Ocorrência não transmitida</div>`;
                } else {
                    const tecText = (!o.tecnico || o.tecnico.toUpperCase().includes("NENHUM")) ? "Desconhecida" : o.tecnico;
                    infoTransmissaoHtml = `<div style="margin-top:4px; font-size:12px; color:#93c5fd; font-weight:bold;">👷 Equipe: ${tecText}</div>`;
                }
            }

            return `
                <div style="background:${cor}; padding:10px; margin-bottom:10px; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="font-weight:bold; font-size:14px; white-space:nowrap;">📌 ${o.os} (${o.prioridade})</div>
                        <div style="display:flex; gap:5px;">
                            <span class="btn-ocultar-os" data-os="${o.os}" style="cursor:pointer; font-size:14px; background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:4px;" title="${osOcultadas.has(o.os) ? 'Remover Ocultação' : 'Ocultar OS'}">
                                ${osOcultadas.has(o.os) ? '👁️' : '➖'}
                            </span>
                            <span class="btn-mute-os" data-os="${o.os}" style="cursor:pointer; font-size:14px; background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:4px;" title="${osMutadas.has(o.os) ? 'Desmutar OS' : 'Mutar OS'}">
                                ${osMutadas.has(o.os) ? '🔇' : '🔊'}
                            </span>
                        </div>
                    </div>
                    <div style="margin-top:4px; font-size:12px;">⏰ SLA: ${o.sla}</div>
                    ${infoTransmissaoHtml}
                    ${o.cancelada ? `
                        <div style="margin-top:10px; font-size:18px; font-weight:bold; color:#888;">🚫 CANCELADA</div>
                    ` : (semChegada ? `
                        <div style="margin-top:10px; font-size:28px; font-weight:bold;">⏳ ${o.minutos === null ? 'N/A' : o.minutos + ' min'}</div>
                    ` : `
                        <div style="margin-top:10px; font-size:14px; font-weight:bold;">${o.atrasado === "Sim" ? "🚨 ATENDIDA COM ATRASO" : "✅ ATENDIDA NO PRAZO"}</div>
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
            if (!osConhecidas.has(os)) novasEncontradas.push(os);
        });
        if (novasEncontradas.length > 0) {
            modalAberto = true;
            modalContent.innerHTML = `
                <div style="font-size:35px; margin-bottom:10px;">🚨</div>
                <div style="font-size:24px; font-weight:bold; color:#3b82f6; margin-bottom:20px;">NOVA OCORRÊNCIA DETECTADA!</div>
                <div style="font-size:18px; max-height: 400px; overflow-y: auto; margin-bottom:25px; color:#cbd5e1; padding-right: 10px;">
                    ${novasEncontradas.map(os => `<div style="margin-bottom:8px; background:#1e293b; padding:10px; border-radius:8px; text-align: left;">📌 ${os}</div>`).join('')}
                </div>
                <button id="btnConfirmaNovaOs" style="background: #3b82f6; color: white; border: none; padding: 15px 30px; font-size: 18px; font-weight: bold; border-radius: 8px; cursor: pointer; width: 100%; box-shadow: 0 5px 15px rgba(59, 130, 246, 0.3);">OK, Ciente</button>
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

    function processarAlertaTransmissao(ocorrenciasBrutas) {
        const agora = Date.now();
        
        // MAPEAMENTO GLOBAL DA OS: Mesma trava global criada pro painel visual
        const statusGlobalOS = {};
        ocorrenciasBrutas.forEach(o => {
            if (!statusGlobalOS[o.os]) statusGlobalOS[o.os] = { temTransmissao: false, temChegada: false };
            if (o.horaTransmissao && !o.horaTransmissao.toUpperCase().includes("NENHUM")) statusGlobalOS[o.os].temTransmissao = true;
            if (o.horaChegada && !o.horaChegada.toUpperCase().includes("NENHUM")) statusGlobalOS[o.os].temChegada = true;
        });

        ocorrenciasBrutas.forEach(o => {
            if (o.tipoAtividade === "PRINCIPAL" && !o.cancelada && !osOcultadas.has(o.os) && !osMutadas.has(o.os)) {
                
                const osStatus = statusGlobalOS[o.os];
                
                // NOVA TRAVA SONORA: Só dispara se NENHUMA linha dessa OS tiver transmissão E chegada
                if (!osStatus.temTransmissao && !osStatus.temChegada) {
                    const tsAbertura = extrairTimestamp(o.dataAbertura);
                    if (tsAbertura > 0) {
                        const minutosPassados = (agora - tsAbertura) / 60000;
                        
                        if (minutosPassados >= 8) { 
                            if (!historicoAlertasTransmissao[o.os]) {
                                historicoAlertasTransmissao[o.os] = true;
                                const finalOs = parseInt(o.os.split('-')[1], 10);
                                dispararVoz(`Atenção. A ocorrência ${finalOs} está há mais de oito minutos sem transmissão.`);
                            }
                        }
                    }
                }
            }
        });
    }

    // === LOOP PRINCIPAL ===
    setInterval(() => {
        if (monitorSlaAtivo || alertaNovasOsAtivo || alertaTransmissaoAtivo) {
            const dadosTela = extrairOcorrenciasDaTela();
            if (monitorSlaAtivo) processarPainelSLA(dadosTela);
            if (alertaNovasOsAtivo) processarNovasOs(dadosTela);
            if (alertaTransmissaoAtivo) processarAlertaTransmissao(dadosTela);
        }
    }, 3000);
})();
