import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendInvoiceEmailRequest {
  to: string;
  invoiceNumber: string;
  shopName: string;
  totalAmount: number;
  pdfBase64: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, invoiceNumber, shopName, totalAmount, pdfBase64 }: SendInvoiceEmailRequest = await req.json();

    console.log("Sending invoice email to:", to);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Sales <sales@mrfogsales.com>",
        to: [to],
        subject: `Invoice ${invoiceNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #333; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Invoice</h1>
            </div>
            
            <div style="padding: 30px; background-color: #f9f9f9;">
              <h2 style="color: #333;">Invoice ${invoiceNumber}</h2>
              <p style="color: #666;">Dear ${shopName},</p>
              <p style="color: #666;">Thank you for your business. Please find your invoice attached.</p>
              
              <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0; color: #666;">Invoice Number: <strong>${invoiceNumber}</strong></p>
                <p style="margin: 10px 0; color: #666;">Total Amount: <strong style="color: #333; font-size: 18px;">$${totalAmount.toFixed(2)}</strong></p>
              </div>
              
              <p style="color: #666;">If you have any questions, please don't hesitate to contact us.</p>
              <p style="color: #666;">Best regards,<br><strong>Sales Team</strong></p>
            </div>
            
            <div style="background-color: #333; padding: 15px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">© 2024 All rights reserved.</p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: `Invoice-${invoiceNumber}.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    if (!emailResponse.ok) {
      throw new Error(`Resend API error: ${await emailResponse.text()}`);
    }

    const result = await emailResponse.json();

    console.log("Email sent successfully:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending invoice email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);