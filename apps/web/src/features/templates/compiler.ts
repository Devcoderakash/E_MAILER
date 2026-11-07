import { EditorDocument, EmailBlock, SampleMergeVariables } from "./types";

/**
 * Compiles a structured block document into an email-client-safe, responsive HTML email.
 */
export function compileBlocksToHTML(
  doc: EditorDocument,
  options?: { preheader?: string; subject?: string }
): string {
  const { blocks, settings } = doc;
  const width = settings.contentWidth || 600;
  const bodyBg = settings.backgroundColor || "#f8fafc";
  const cardBg = settings.cardColor || "#ffffff";
  const fontFamily =
    settings.fontFamily ||
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  // Preheader snippet for inbox preview line
  const preheaderHTML = options?.preheader
    ? `<div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">
        ${escapeHTML(options.preheader)}
        &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
      </div>`
    : "";

  const renderedBlocks = blocks.map((block) => renderBlock(block)).join("\n");

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${options?.subject ? escapeHTML(options.subject) : "MailPilot Email"}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; }
    @media only screen and (max-width: 620px) {
      .responsive-table { width: 100% !important; max-width: 100% !important; }
      .responsive-cell { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .mobile-padding { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${bodyBg}; font-family: ${fontFamily};">
  ${preheaderHTML}
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${bodyBg};">
    <tr>
      <td align="center" style="padding: 32px 12px;">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="${width}">
        <tr>
        <td align="center" valign="top" width="${width}">
        <![endif]-->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="responsive-table" style="max-width: ${width}px; background-color: ${cardBg}; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <tr>
            <td>
              ${renderedBlocks}
            </td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case "header": {
      return `
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${block.bgColor};">
        <tr>
          <td align="${block.align}" style="padding: ${block.padding}px 24px;">
            <h1 style="margin: 0; color: ${block.textColor}; font-size: 24px; font-weight: 700; line-height: 1.3;">
              ${escapeHTML(block.title)}
            </h1>
            ${
              block.subtitle
                ? `<p style="margin: 8px 0 0; color: ${block.textColor}; opacity: 0.9; font-size: 14px; line-height: 1.4;">${escapeHTML(block.subtitle)}</p>`
                : ""
            }
          </td>
        </tr>
      </table>`;
    }

    case "heading": {
      const sizes = { 1: "26px", 2: "20px", 3: "17px" };
      const fontSize = sizes[block.level] || "22px";
      return `
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="${block.align}" style="padding: ${block.paddingTop}px 24px ${block.paddingBottom}px 24px;">
            <h${block.level} style="margin: 0; color: ${block.color}; font-size: ${fontSize}; font-weight: 700; line-height: 1.3;">
              ${escapeHTML(block.text)}
            </h${block.level}>
          </td>
        </tr>
      </table>`;
    }

    case "text": {
      // Split paragraphs by newline and format
      const paragraphs = block.content
        .split("\n")
        .filter((p) => p.trim())
        .map(
          (p) =>
            `<p style="margin: 0 0 14px; font-size: ${block.fontSize}px; line-height: ${block.lineHeight}; color: ${block.color}; text-align: ${block.align};">${p}</p>`
        )
        .join("\n");

      return `
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: ${block.paddingTop}px 24px ${block.paddingBottom}px 24px;">
            ${paragraphs || `<p style="margin: 0; font-size: ${block.fontSize}px; line-height: ${block.lineHeight}; color: ${block.color}; text-align: ${block.align};">&nbsp;</p>`}
          </td>
        </tr>
      </table>`;
    }

    case "button": {
      return `
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="${block.align}" style="padding: 20px 24px;">
            <table role="presentation" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: ${block.borderRadius}px; background-color: ${block.bgColor};">
                  <a href="${escapeHTML(block.url || "#")}" target="_blank" style="display: inline-block; padding: ${block.paddingY}px ${block.paddingX}px; font-size: 14px; font-weight: 600; color: ${block.textColor}; text-decoration: none; border-radius: ${block.borderRadius}px; background-color: ${block.bgColor}; mso-padding-alt: 0;">
                    <!--[if mso]><i style="letter-spacing: ${block.paddingX}px; mso-font-width: -100%;" hidden>&nbsp;</i><![endif]-->
                    <span style="mso-text-raise: 10pt; font-weight: 600;">${escapeHTML(block.text)}</span>
                    <!--[if mso]><i style="letter-spacing: ${block.paddingX}px;" hidden>&nbsp;</i><![endif]-->
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
    }

    case "image": {
      const imgTag = `<img src="${escapeHTML(block.src)}" alt="${escapeHTML(block.alt || "")}" width="${block.width}" style="display: block; max-width: 100%; height: auto; border-radius: ${block.borderRadius}px; border: 0;" />`;
      const content = block.url
        ? `<a href="${escapeHTML(block.url)}" target="_blank" style="text-decoration: none;">${imgTag}</a>`
        : imgTag;

      return `
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="${block.align}" style="padding: 16px 24px;">
            ${content}
          </td>
        </tr>
      </table>`;
    }

    case "divider": {
      return `
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: ${block.margin}px 24px;">
            <div style="border-top: ${block.thickness}px ${block.style} ${block.color}; margin: 0; width: 100%;"></div>
          </td>
        </tr>
      </table>`;
    }

    case "spacer": {
      return `
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td height="${block.height}" style="font-size: 0; line-height: 0; mso-line-height-rule: exactly; height: ${block.height}px;">
            &nbsp;
          </td>
        </tr>
      </table>`;
    }

    case "columns": {
      return `
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${block.bgColor || "transparent"};">
        <tr>
          <td style="padding: ${block.padding}px 24px;">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td class="responsive-cell" width="48%" valign="top" style="padding-bottom: 12px; font-size: 14px; line-height: 1.5; color: #475569;">
                  ${block.leftContent}
                </td>
                <td class="responsive-cell" width="4%">&nbsp;</td>
                <td class="responsive-cell" width="48%" valign="top" style="padding-bottom: 12px; font-size: 14px; line-height: 1.5; color: #475569;">
                  ${block.rightContent}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
    }

    case "footer": {
      return `
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${block.bgColor}; border-top: 1px solid #e2e8f0;">
        <tr>
          <td align="center" style="padding: 24px 20px; font-size: 12px; line-height: 1.6; color: ${block.textColor};">
            <p style="margin: 0 0 6px; font-weight: 600;">${escapeHTML(block.companyName)}</p>
            <p style="margin: 0 0 10px;">${escapeHTML(block.address)}</p>
            <p style="margin: 0; font-size: 11px;">
              <a href="#" style="color: ${block.textColor}; text-decoration: underline;">${escapeHTML(block.unsubscribeText)}</a>
            </p>
          </td>
        </tr>
      </table>`;
    }

    default:
      return "";
  }
}

/**
 * Replaces dynamic merge variables in HTML safely without executing code.
 */
export function interpolateVariables(
  html: string,
  vars: SampleMergeVariables
): string {
  return html
    .replace(/\{\{\s*first_name\s*\}\}/gi, escapeHTML(vars.first_name || "Subscriber"))
    .replace(/\{\{\s*firstName\s*\}\}/gi, escapeHTML(vars.first_name || "Subscriber"))
    .replace(/\{\{\s*last_name\s*\}\}/gi, escapeHTML(vars.last_name || ""))
    .replace(/\{\{\s*lastName\s*\}\}/gi, escapeHTML(vars.last_name || ""))
    .replace(/\{\{\s*email\s*\}\}/gi, escapeHTML(vars.email || "user@example.com"))
    .replace(/\{\{\s*company\s*\}\}/gi, escapeHTML(vars.company || "Acme Corp"));
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
