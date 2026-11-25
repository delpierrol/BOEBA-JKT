import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse request body
        const { token } = await req.json();
        
        if (!token) {
            return Response.json({ 
                success: false, 
                error: 'reCAPTCHA token is required' 
            }, { status: 400 });
        }
        
        // Get secret key from environment
        const secretKey = Deno.env.get("RECAPTCHA_SECRET_KEY");
        
        if (!secretKey) {
            console.error("RECAPTCHA_SECRET_KEY not found in environment");
            return Response.json({ 
                success: false, 
                error: 'Server configuration error' 
            }, { status: 500 });
        }
        
        // Verify reCAPTCHA token with Google
        const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
        const verifyResponse = await fetch(verifyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `secret=${secretKey}&response=${token}`
        });
        
        const verifyData = await verifyResponse.json();
        
        if (verifyData.success) {
            return Response.json({ 
                success: true,
                message: 'reCAPTCHA verified successfully'
            });
        } else {
            return Response.json({ 
                success: false, 
                error: 'reCAPTCHA verification failed',
                details: verifyData['error-codes']
            }, { status: 400 });
        }
        
    } catch (error) {
        console.error("Error in verifyRecaptcha:", error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});