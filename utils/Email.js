import { Verification_Email_Template, Welcome_Email_Template } from "./EmailTemplate.js";
import { transporter } from "./Email.config.js";
//  console.log(transporter);
 
export const sendVerificationEmail=async(email,verificationCode)=>{
    try {
     const response=   await transporter.sendMail({
            from: '"AI-MALL" <yugamcteam@gmail.com>',

            to: email, // list of receivers
            subject: "Verify your Email", // Subject line
            text: "Verify your Email", // plain text body
            html: Verification_Email_Template.replace("{verificationCode}",verificationCode)
        })
        console.log('Email send Successfully',response)
    } catch (error) {
        console.log('Email error',error)
    }
}

//WELCOME EMAIL
export const welcomeEmail = async (name,email) => {
  const info = await transporter.sendMail({
    from: '"AI-MALL" <yugamcteam@gmail.com>',
    to: email,
    subject: `Welcome ${name}`,
    text: "Hello world?", // plain‑text body
    html: Welcome_Email_Template.replace("{name}",name), // HTML body
  });

  console.log("Message sent:", info.messageId);
};

