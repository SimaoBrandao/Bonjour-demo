(function (window) {

    "use strict";

    class Bonjour {

        constructor(opcoes) {

            opcoes = opcoes || {};

            this.baseUrl = opcoes.baseUrl || "http://localhost:1975";
            this.token = opcoes.token || "";
            this.tentativas = 10;
            this.intervalo = 1000;
        }

        async isAvailable() {

            try {

                const resposta = await this._request("/status",
                        {
                            method: "GET"
                        }
                    );

                return resposta && resposta.success === true;

            }
            catch (erro) {

                return false;
            }
        }

        async status() {

            return await this._request("/status",
                {
                    method: "GET"
                }
            );
        }

        async scanners() {

            const resposta = await this._request("/scanners",
                    {
                        method: "GET"
                    }
                );

            return resposta.scanners || [];
        }

        async scan() {

    let resposta;

    try {

        resposta = await fetch(this.baseUrl + "/scan",
                {
                    method: "POST",
                    headers: {"Authorization": this.token}
                }
            );

    }
    catch (erro) {

        throw new Error(
            "Não foi possível conectar ao Bonjour. " + "Verifique se o Bonjour está em execução."
        );
    }
   
    if (!resposta.ok) {

        let dados = null;

        try {

            dados = await resposta.json();
        }
        catch (erro) {
        }

        throw new Error(dados && dados.error ? dados.error : "Erro HTTP " + resposta.status);
    }
   
    const blob = await resposta.blob();    
    let nome = "documento_digitalizado.pdf";
    const disposicao = resposta.headers.get("Content-Disposition");

    if (disposicao) {

        const resultado =  /filename="([^"]+)"/i.exec(disposicao);
        if (resultado) {
            nome = resultado[1];
        }
    }
   
    const ficheiro = new File([blob], nome,
            {
                type: "application/pdf",
                lastModified: Date.now()
            }
        );

    return {
        file: ficheiro,
        blob: blob,
        fileName: nome,
        mimeType: "application/pdf"
    };
}

        async download() {
            const resultado = await this.scan();
            const url = URL.createObjectURL(resultado.blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = resultado.fileName;
            document.body.appendChild(link);

            link.click();
            link.remove();
            setTimeout(
                function () {
                    URL.revokeObjectURL(url);
                },
                1000
            );

            return resultado;
        }

        async scanToFormData(formData, nomeCampo) {

            nomeCampo = nomeCampo || "file";
            const resultado = await this.scan();
            formData.append(nomeCampo, resultado.file);
            return resultado;
        }

        async _aguardarDisponibilidade() {

            for (let tentativa = 1; tentativa <= this.tentativas; tentativa++) {

                if (await this.isAvailable()) {
                    return true;
                }

                if (tentativa < this.tentativas) {

                    await new Promise(
                        function (resolver) {

                            setTimeout(
                                resolver,
                                this.intervalo
                            );

                        }.bind(this)
                    );
                }
            }

            return false;
        }

        async _request(endpoint, opcoes, tentarNovamente = true) {

            opcoes = opcoes || {};
            const cabecalhos = Object.assign({}, opcoes.headers || {},
                    {
                        "Authorization": this.token
                    });

            if (opcoes.body) {
                cabecalhos["Content-Type"] = "application/json";
            }

            opcoes.headers = cabecalhos;
            let resposta;

            try {

                resposta =  await fetch(this.baseUrl + endpoint, opcoes);
            }
            catch (erro) {

                if (tentarNovamente) {
                    throw erro;
                }

                throw new Error("Não foi possível conectar ao Bonjour. " + "Verifique se o Bonjour está em execução.");
            }

            const texto =  await resposta.text();
            let dados;

            try {

                dados = texto ? JSON.parse(texto) : null;
            }
            catch (erro) {

                throw new Error("O Bonjour devolveu uma resposta inválida.");
            }

            if (!resposta.ok) {

                throw new Error(dados && dados.error ? dados.error : "Erro HTTP " + resposta.status);
            }

            return dados;
        }

        static _base64ToBlob(base64, mimeType) {

            const binario = window.atob(base64);
            const tamanho = binario.length;
            const bytes = new Uint8Array(tamanho);

            for (let i = 0; i < tamanho; i++) {

                bytes[i] = binario.charCodeAt(i);
            }

            return new Blob(
                [bytes],
                {
                    type: mimeType
                }
            );
        }
    }

    window.Bonjour = Bonjour;

})(window);