/**
 * Módulo Oficial de Geração de PIX (Padrão Banco Central do Brasil - BR Code / EMV)
 * Gera código 'PIX Copia e Cola' válido para qualquer banco brasileiro (Nubank, Inter, Itaú, etc.)
 * e suporta integração direta com a API do Mercado Pago.
 */

const https = require('https');

class PixService {
  /**
   * Calcula o CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)
   * exigido pela especificação oficial do Banco Central.
   */
  calculateCRC16(payload) {
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
      crc ^= (payload.charCodeAt(i) << 8);
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  formatField(id, value) {
    const len = String(value.length).padStart(2, '0');
    return `${id}${len}${value}`;
  }

  /**
   * Gera a string oficial do PIX Copia e Cola (BR Code estático ou dinâmico)
   */
  generateBrCode({ pixKey, amount, merchantName = 'FOCOGENTIL', merchantCity = 'SAO PAULO', txid = '***' }) {
    const cleanKey = String(pixKey).trim();
    const formattedAmount = Number(amount).toFixed(2);
    
    // 26: Merchant Account Information
    const gui = this.formatField('00', 'br.gov.bcb.pix');
    const keyField = this.formatField('01', cleanKey);
    const merchantAccountInfo = this.formatField('26', gui + keyField);

    // 52: Merchant Category Code (0000 = geral)
    const mcc = this.formatField('52', '0000');
    // 53: Moeda (986 = BRL)
    const currency = this.formatField('53', '986');
    // 54: Valor da transação
    const amountField = this.formatField('54', formattedAmount);
    // 58: País (BR)
    const country = this.formatField('58', 'BR');
    // 59: Nome do recebedor (máx 25 caracteres, sem acentos)
    const cleanName = merchantName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 25).toUpperCase();
    const nameField = this.formatField('59', cleanName || 'FOCOGENTIL');
    // 60: Cidade do recebedor (máx 15 caracteres, sem acentos)
    const cleanCity = merchantCity.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 15).toUpperCase();
    const cityField = this.formatField('60', cleanCity || 'SAO PAULO');
    // 62: Dados adicionais (txid)
    const txidSubfield = this.formatField('05', txid || '***');
    const additionalData = this.formatField('62', txidSubfield);

    // Concatenação dos campos base + indicador de CRC (6304)
    const rawPayload = (
      '000201' + // Format Indicator
      merchantAccountInfo +
      mcc +
      currency +
      amountField +
      country +
      nameField +
      cityField +
      additionalData +
      '6304'
    );

    const crc = this.calculateCRC16(rawPayload);
    return rawPayload + crc;
  }

  /**
   * Cria um PIX dinâmico diretamente na API do Mercado Pago caso um Access Token seja configurado.
   */
  async createMercadoPagoPix({ accessToken, amount, customerEmail, customerName, description }) {
    if (!accessToken) return null;

    const payload = JSON.stringify({
      transaction_amount: Number(amount),
      description: description || 'FocoGentil - Acesso Vitalicio',
      payment_method_id: 'pix',
      payer: {
        email: customerEmail || 'cliente@focogentil.com',
        first_name: customerName || 'Cliente'
      }
    });

    return new Promise((resolve, reject) => {
      const req = https.request('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': 'pix_' + Date.now()
        },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const poi = json.point_of_interaction?.transaction_data;
              resolve({
                payment_id: String(json.id),
                qr_code: poi?.qr_code,
                qr_code_base64: poi?.qr_code_base64,
                ticket_url: poi?.ticket_url
              });
            } else {
              console.warn('[MercadoPago PIX] Erro na API:', json);
              resolve(null);
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', (err) => {
        console.warn('[MercadoPago PIX] Falha na requisição:', err.message);
        resolve(null);
      });

      req.write(payload);
      req.end();
    });
  }
}

module.exports = new PixService();
