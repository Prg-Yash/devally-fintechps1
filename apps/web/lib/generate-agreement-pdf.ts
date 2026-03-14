import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Types ───
interface Milestone {
  id: string;
  title: string;
  description?: string;
  amount: number;
  status: string;
  dueDate?: string;
}

interface Agreement {
  id: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  creator: { id: string; name: string; email: string };
  receiver: { id: string; name: string; email: string };
  milestones: Milestone[];
}

// ─── Color Palette ───
const COLORS = {
  dark: [26, 36, 6] as [number, number, number],        // #1A2406
  accent: [217, 242, 79] as [number, number, number],    // #D9F24F
  white: [255, 255, 255] as [number, number, number],
  lightGray: [245, 245, 244] as [number, number, number],
  midGray: [120, 120, 115] as [number, number, number],
  textDark: [30, 30, 30] as [number, number, number],
  textMuted: [100, 100, 100] as [number, number, number],
  border: [220, 220, 218] as [number, number, number],
  greenBg: [240, 253, 244] as [number, number, number],
  greenText: [22, 101, 52] as [number, number, number],
};

export function generateAgreementPDF(agreement: Agreement) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADER BAR
  // ═══════════════════════════════════════════════════════════════════════════
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, pageWidth, 42, "F");

  // Accent stripe
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 42, pageWidth, 2, "F");

  // Logo text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.white);
  doc.text("PAYCROW", margin, 18);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.accent);
  doc.text("SECURE ESCROW AGREEMENT", margin, 25);

  // Agreement ID on the right
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255, 0.5);
  doc.text(`REF: ${agreement.id.toUpperCase()}`, pageWidth - margin, 18, { align: "right" });

  // Date on the right
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.accent);
  const formattedDate = new Date(agreement.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(formattedDate, pageWidth - margin, 25, { align: "right" });

  // Status badge
  doc.setFontSize(7);
  const statusText = agreement.status.toUpperCase();
  const statusWidth = doc.getTextWidth(statusText) + 10;
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(pageWidth - margin - statusWidth, 30, statusWidth, 7, 2, 2, "F");
  doc.setTextColor(...COLORS.dark);
  doc.setFont("helvetica", "bold");
  doc.text(statusText, pageWidth - margin - statusWidth / 2, 34.5, { align: "center" });

  y = 54;

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT TITLE
  // ═══════════════════════════════════════════════════════════════════════════
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.textDark);
  doc.text(agreement.title, margin, y);
  y += 10;

  // Thin separator
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTIES SECTION
  // ═══════════════════════════════════════════════════════════════════════════
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.midGray);
  doc.text("PARTIES TO THIS AGREEMENT", margin, y);
  y += 8;

  // Two-column party boxes
  const boxW = (contentWidth - 8) / 2;
  const boxH = 28;

  // Client box
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, y, boxW, boxH, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.midGray);
  doc.text("CLIENT (PAYER)", margin + 6, y + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textDark);
  doc.text(agreement.creator.name, margin + 6, y + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(agreement.creator.email, margin + 6, y + 22);

  // Freelancer box
  const rightX = margin + boxW + 8;
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(rightX, y, boxW, boxH, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.midGray);
  doc.text("FREELANCER (PAYEE)", rightX + 6, y + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textDark);
  doc.text(agreement.receiver.name, rightX + 6, y + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(agreement.receiver.email, rightX + 6, y + 22);

  y += boxH + 12;

  // ═══════════════════════════════════════════════════════════════════════════
  // DESCRIPTION (if present)
  // ═══════════════════════════════════════════════════════════════════════════
  if (agreement.description) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.midGray);
    doc.text("PROJECT DESCRIPTION", margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textDark);
    const descLines = doc.splitTextToSize(agreement.description, contentWidth - 4);
    doc.text(descLines, margin + 2, y);
    y += descLines.length * 4.5 + 8;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.midGray);
  doc.text("FINANCIAL SUMMARY", margin, y);
  y += 8;

  // Total amount highlight
  doc.setFillColor(...COLORS.dark);
  doc.roundedRect(margin, y, contentWidth, 20, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.accent);
  doc.text("TOTAL ESCROW AMOUNT", margin + 8, y + 8);
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.white);
  doc.text(`${agreement.amount.toLocaleString()} ${agreement.currency}`, margin + 8, y + 16);

  // Status on the right
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.accent);
  doc.text("Secured in Smart Contract", pageWidth - margin - 8, y + 12, { align: "right" });

  y += 28;

  // ═══════════════════════════════════════════════════════════════════════════
  // MILESTONES TABLE
  // ═══════════════════════════════════════════════════════════════════════════
  if (agreement.milestones.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.midGray);
    doc.text("MILESTONE SCHEDULE", margin, y);
    y += 4;

    const tableBody = agreement.milestones.map((ms, i) => [
      `${i + 1}`,
      ms.title,
      ms.dueDate ? new Date(ms.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
      `${ms.amount.toLocaleString()} ${agreement.currency}`,
      ms.status.toUpperCase(),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["#", "MILESTONE", "DUE DATE", "AMOUNT", "STATUS"]],
      body: tableBody,
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
        textColor: COLORS.textDark,
        lineColor: COLORS.border,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: COLORS.lightGray,
        textColor: COLORS.midGray,
        fontStyle: "bold",
        fontSize: 7,
      },
      alternateRowStyles: {
        fillColor: [252, 252, 251],
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 30 },
        3: { cellWidth: 30, halign: "right", fontStyle: "bold" },
        4: { cellWidth: 22, halign: "center", fontSize: 7 },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // Milestones total row
    const milestonesTotal = agreement.milestones.reduce((sum, m) => sum + m.amount, 0);
    doc.setFillColor(...COLORS.greenBg);
    doc.roundedRect(margin, y, contentWidth, 10, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.greenText);
    doc.text("MILESTONES TOTAL", margin + 6, y + 6.5);
    doc.text(`${milestonesTotal.toLocaleString()} ${agreement.currency}`, pageWidth - margin - 6, y + 6.5, { align: "right" });

    y += 16;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TERMS & CONDITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // Check if we need a new page
  if (y > pageHeight - 80) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.midGray);
  doc.text("TERMS & CONDITIONS", margin, y);
  y += 7;

  const terms = [
    "1. Funds are held in an on-chain escrow smart contract until milestone completion is verified.",
    "2. Deliverables are verified using AI-powered analysis (text, code, and vision models).",
    "3. Upon successful verification, funds are automatically released to the freelancer's wallet.",
    "4. Either party may raise a dispute ticket for manual or AI-assisted arbitration.",
    "5. This agreement is governed by the terms of the PayCrow platform and the underlying smart contract.",
    "6. The on-chain record is the legally binding version of this agreement.",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.textMuted);

  terms.forEach((term) => {
    const lines = doc.splitTextToSize(term, contentWidth - 4);
    doc.text(lines, margin + 2, y);
    y += lines.length * 3.5 + 2;
  });

  y += 6;

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNATURE LINES
  // ═══════════════════════════════════════════════════════════════════════════

  if (y > pageHeight - 50) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.midGray);
  doc.text("DIGITAL SIGNATURES", margin, y);
  y += 12;

  // Client signature line
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.4);
  doc.line(margin, y + 10, margin + boxW - 10, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(agreement.creator.name, margin, y + 16);
  doc.setFontSize(7);
  doc.text("Client (Payer)", margin, y + 21);

  // Freelancer signature line
  doc.line(rightX, y + 10, rightX + boxW - 10, y + 10);
  doc.setFontSize(8);
  doc.text(agreement.receiver.name, rightX, y + 16);
  doc.setFontSize(7);
  doc.text("Freelancer (Payee)", rightX, y + 21);

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer bar
    doc.setFillColor(...COLORS.dark);
    doc.rect(0, pageHeight - 14, pageWidth, 14, "F");

    // Accent line
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, pageHeight - 14, pageWidth, 0.5, "F");

    // Brand
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.accent);
    doc.text("PAYCROW", margin, pageHeight - 6);

    // Tagline
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255, 0.4);
    doc.text("Secured by AI • Protected by Blockchain", margin + 22, pageHeight - 6);

    // Page number
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255, 0.3);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════════════════
  const filename = `PayCrow_Agreement_${agreement.title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}_${agreement.id.slice(-6)}.pdf`;
  doc.save(filename);
}
