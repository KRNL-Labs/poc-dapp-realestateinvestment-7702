package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type WorkflowRequest struct {
	ID      int         `json:"id"`
	JsonRPC string      `json:"jsonrpc"`
	Method  string      `json:"method"`
	Params  []any       `json:"params"`
}

type ProxyRequest struct {
	Workflow any `json:"workflow"`
}

func main() {
	r := gin.Default()

	// CORS configuration
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:5173", "http://localhost:3000"} // Add your frontend URLs
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	config.AllowCredentials = true
	r.Use(cors.New(config))

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "healthy",
			"time":   time.Now().UTC(),
		})
	})

	// Proxy endpoint for KRNL workflow execution
	r.POST("/api/execute-workflow", func(c *gin.Context) {
		var req ProxyRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request body"})
			return
		}

		// Construct the KRNL node request
		krnlRequest := WorkflowRequest{
			ID:      1,
			JsonRPC: "2.0",
			Method:  "krnl_executeWorkflow",
			Params:  []any{req.Workflow},
		}

		// Marshal the request
		requestBody, err := json.Marshal(krnlRequest)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to marshal request"})
			return
		}

		// Create HTTP request to KRNL node
		httpReq, err := http.NewRequest("POST", "https://v0-1-0.node.lat/", bytes.NewBuffer(requestBody))
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to create request"})
			return
		}

		// Set required headers
		httpReq.Header.Set("Accept", "application/vnd.oci.image.manifest.v1+json")
		httpReq.Header.Set("Content-Type", "application/json")

		// Execute request
		client := &http.Client{Timeout: 60 * time.Second}
		resp, err := client.Do(httpReq)
		if err != nil {
			c.JSON(500, gin.H{"error": fmt.Sprintf("Request failed: %v", err)})
			return
		}
		defer resp.Body.Close()

		// Read response
		responseBody, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to read response"})
			return
		}

		// Parse and return response
		var result any
		if err := json.Unmarshal(responseBody, &result); err != nil {
			// If JSON parsing fails, return raw response
			c.JSON(resp.StatusCode, gin.H{
				"raw_response": string(responseBody),
				"status_code":  resp.StatusCode,
			})
			return
		}

		c.JSON(resp.StatusCode, result)
	})

	fmt.Println("Backend server starting on :8080")
	fmt.Println("CORS enabled for frontend development")
	r.Run(":8080")
}