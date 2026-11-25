import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Check if user is authenticated (optional for public booking system)
        // We'll allow both authenticated and non-authenticated requests
        let user = null;
        try {
            user = await base44.auth.me();
        } catch (e) {
            // User not authenticated - that's OK for public bookings
            console.log('Request from non-authenticated user (public booking)');
        }

        const { phoneNumber, message } = await req.json();

        if (!phoneNumber || !message) {
            return Response.json({ 
                error: 'Missing required fields: phoneNumber and message' 
            }, { status: 400 });
        }

        const apiUrl = Deno.env.get("WPPCONNECT_API_URL");
        const sessionName = Deno.env.get("WPPCONNECT_SESSION_NAME");
        const secretKey = Deno.env.get("WPPCONNECT_SECRET_KEY");

        console.log('WPPConnect Config:', { 
            apiUrl, 
            sessionName, 
            hasSecretKey: !!secretKey,
            secretKeyLength: secretKey?.length || 0,
            isAuthenticated: !!user
        });

        if (!apiUrl || !sessionName || !secretKey) {
            return Response.json({ 
                error: 'WPPConnect configuration missing. Please set WPPCONNECT_API_URL, WPPCONNECT_SESSION_NAME, and WPPCONNECT_SECRET_KEY' 
            }, { status: 500 });
        }

        // Format phone number (remove +, spaces, dashes, and parentheses)
        let formattedPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
        
        // Ensure it has country code format (e.g., 628111083547)
        if (!formattedPhone.startsWith('62') && formattedPhone.startsWith('0')) {
            formattedPhone = '62' + formattedPhone.substring(1);
        }

        console.log('Sending WhatsApp to:', formattedPhone);

        // Build base URL
        const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;

        // Step 1: Generate token
        const tokenUrl = `${baseUrl}/api/${sessionName}/${secretKey}/generate-token`;
        console.log('Generating token from:', tokenUrl.replace(secretKey, '[REDACTED]'));

        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const tokenText = await tokenResponse.text();
        console.log('Token Response Status:', tokenResponse.status);
        console.log('Token Response:', tokenText);

        if (!tokenResponse.ok) {
            console.error('Failed to generate token:', tokenText);
            return Response.json({ 
                success: false,
                error: 'Failed to generate authentication token',
                details: tokenText,
                hint: 'Check if WPPCONNECT_SESSION_NAME and WPPCONNECT_SECRET_KEY are correct'
            }, { status: 500 });
        }

        let tokenData;
        try {
            tokenData = JSON.parse(tokenText);
        } catch (e) {
            console.error('Failed to parse token response:', e);
            return Response.json({ 
                success: false,
                error: 'Invalid token response format',
                details: tokenText
            }, { status: 500 });
        }

        const token = tokenData.token;
        if (!token) {
            return Response.json({ 
                success: false,
                error: 'Token not found in response',
                details: tokenData
            }, { status: 500 });
        }

        console.log('Token generated successfully');

        // Step 2: Send message using the token
        const sendMessageUrl = `${baseUrl}/api/${sessionName}/send-message`;
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const requestBody = {
            phone: formattedPhone,
            message: message,
            isGroup: false
        };

        console.log('Sending message to:', sendMessageUrl);
        console.log('Request Body:', JSON.stringify(requestBody, null, 2));

        const messageResponse = await fetch(sendMessageUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        const messageText = await messageResponse.text();
        console.log('Message Response Status:', messageResponse.status);
        console.log('Message Response:', messageText);

        if (!messageResponse.ok) {
            console.error('WPPConnect API Error:', messageText);
            return Response.json({ 
                success: false,
                error: 'Failed to send WhatsApp message',
                details: messageText,
                status: messageResponse.status
            }, { status: 500 });
        }

        let result;
        try {
            result = JSON.parse(messageText);
        } catch (e) {
            result = { raw: messageText };
        }

        console.log('WhatsApp sent successfully:', result);

        return Response.json({ 
            success: true,
            message: 'WhatsApp message sent successfully',
            data: result
        });

    } catch (error) {
        console.error('Error sending WhatsApp:', error);
        return Response.json({ 
            success: false,
            error: 'Failed to send WhatsApp message',
            details: error.message 
        }, { status: 500 });
    }
});