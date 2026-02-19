# Deploying Backend to Google Cloud Run

This backend is container-ready using Docker.

## Prerequisites

- Google Cloud Project with Cloud Run enabled.
- Google Cloud SDK (gcloud CLI) installed.

## 1. Build the Container

Unlike the frontend, the backend doesn't need build arguments.

```bash
# Build the Docker image
docker build -t a-series-backend .
```

## 2. Test Locally (Optional)

```bash
docker run -p 8080:8080 -e MONGO_URI="your_mongo_uri" -e JWT_SECRET="your_secret" ... a-series-backend
```

Visit `http://localhost:8080/ping-top` to test.

## 3. Deploy to Cloud Run

You can deploy directly from source using this command:

```bash
gcloud run deploy a-series-backend \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated
```

## 4. Setting Environment Variables (CRITICAL)

Your backend REQUIRES environment variables (like `MONGO_URI`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, etc.) to function.

**You MUST set these variables in the Cloud Run service configuration.**

You can do this via the Google Cloud Console UI, or by running this command AFTER deployment:

```bash
gcloud run services update a-series-backend \
  --region asia-south1 \
  --set-env-vars MONGO_URI="your_mongo_uri",JWT_SECRET="your_secret_key",RAZORPAY_KEY_ID="rzp_test_..."
```

Refer to your local `.env` file for the list of variables you need to set.
