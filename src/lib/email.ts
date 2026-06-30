import {Resend} from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type EmailProps = {
    to:string,
    contractName:string,
    contractId:string,
    highRiskCount:number,
    mediumRiskCount:number,
    lowRiskCount:number,
}

export async function sendReviewNotification({to, contractName, contractId, highRiskCount, mediumRiskCount, lowRiskCount}:EmailProps){
    const reviewUrl = `${process.env.NEXTAUTH_URL}/dashboard/contracts/${contractId}/review`

    await resend.emails.send({
        from: "ContractReview AI <onboarding@resend.dev>",
        to,
        subject: `Review ready: ${contractName}`,
        html: `
        <div style="font-family: sans-serif; max-width: 480px;">
        <h2>Your contract analysis is ready for review</h2>
        <p><strong>${contractName}</strong> has been analysed and is waiting for your review.</p>
        <ul>
          <li><strong>${highRiskCount}</strong> high risk clauses</li>
          <li><strong>${mediumRiskCount}</strong> medium risk clauses</li>
          <li><strong>${lowRiskCount}</strong> low risk clauses</li>
        </ul>
        <p>
          <a href="${reviewUrl}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Review Contract
          </a>
        </p>
        </div>
    `,
    })
}