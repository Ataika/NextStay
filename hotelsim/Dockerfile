FROM python:3.12-slim
WORKDIR /app
COPY hotelsim/requirements.txt /app/hotelsim/requirements.txt
RUN pip install --no-cache-dir -r /app/hotelsim/requirements.txt
COPY hotelsim /app/hotelsim
ENV HOTELSIM_DB_PATH=/app/hotelsim.db
EXPOSE 8090
CMD ["uvicorn", "hotelsim.app:app", "--host", "0.0.0.0", "--port", "8090"]
