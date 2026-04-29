import uvicorn
import logging


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

if __name__ == "__main__":
    uvicorn.run(
        "app.ui.api:app",
        host="127.0.0.1",
        port=8000,
        reload=False,  
    )
 